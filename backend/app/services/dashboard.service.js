const { hasPermission } = require("../config/permissions");
const {
  buildBatchStockLookup,
  PUBLIC_PRODUCT_FILTER,
} = require("../utils/inventory-query.util");
const ExpiryMonitoringService = require("./expiry-monitoring.service");
const {
  resolvePeriod,
  growth,
  fillSeries,
  DAY,
  TIMEZONE,
} = require("../utils/dashboard.util");
const { localDay } = require("../utils/subscription-schedule.util");

const ORDER_LABELS = {
  awaiting_payment: "Chờ thanh toán",
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  canceled: "Đã hủy",
  cancel_pending: "Chờ hoàn tiền",
};
const statusExpression = (field) => ({
  $switch: {
    branches: [
      { case: { $eq: [field, "delivered"] }, then: "completed" },
      { case: { $eq: [field, "confirmed"] }, then: "processing" },
      { case: { $eq: [field, "cancelled"] }, then: "canceled" },
    ],
    default: field,
  },
});
const range = (start, end) => ({ $gte: start, $lt: end });
const inPeriod = (field, start, end) => ({
  $and: [{ $gte: [field, start] }, { $lt: [field, end] }],
});
const sumIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const validMoney = (field) => ({
  $and: [{ $isNumber: field }, { $gte: [field, 0] }],
});
const validDate = (field) => ({ $eq: [{ $type: field }, "date"] });
const numeric = (field) => ({
  $convert: { input: field, to: "double", onError: null, onNull: null },
});
const dateKey = (field, p) => ({
  $dateToString: {
    date: field,
    format: p.groupBy === "month" ? "%Y-%m" : "%Y-%m-%d",
    timezone: TIMEZONE,
  },
});
const paymentLookup = {
  $lookup: {
    from: "payments",
    localField: "_id",
    foreignField: "order_id",
    as: "payments",
  },
};
const firstTimeline = (statuses) => ({
  $arrayElemAt: [
    {
      $map: {
        input: {
          $filter: {
            input: { $ifNull: ["$timeline", []] },
            as: "t",
            cond: {
              $and: [
                { $in: ["$$t.status", statuses] },
                validDate("$$t.changed_at"),
              ],
            },
          },
        },
        as: "t",
        in: "$$t.changed_at",
      },
    },
    0,
  ],
});

// Costs use the immutable FEFO allocation saved on the order, never today's price.
function costStages() {
  return [
    {
      $set: {
        _costRows: {
          $map: {
            input: { $ifNull: ["$items", []] },
            as: "i",
            in: {
              cost: {
                $sum: {
                  $map: {
                    input: { $ifNull: ["$$i.batchAllocations", []] },
                    as: "b",
                    in: {
                      $multiply: [
                        numeric("$$b.quantity"),
                        numeric("$$b.importPrice"),
                      ],
                    },
                  },
                },
              },
              valid: {
                $and: [
                  {
                    $gt: [
                      { $size: { $ifNull: ["$$i.batchAllocations", []] } },
                      0,
                    ],
                  },
                  {
                    $eq: [
                      { $sum: "$$i.batchAllocations.quantity" },
                      "$$i.quantity",
                    ],
                  },
                  {
                    $allElementsTrue: [
                      {
                        $map: {
                          input: { $ifNull: ["$$i.batchAllocations", []] },
                          as: "b",
                          in: {
                            $and: [
                              validMoney("$$b.importPrice"),
                              { $isNumber: "$$b.quantity" },
                              { $gt: ["$$b.quantity", 0] },
                            ],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
    {
      $set: {
        _costComplete: {
          $and: [
            { $gt: [{ $size: "$_costRows" }, 0] },
            { $allElementsTrue: ["$_costRows.valid"] },
          ],
        },
        _cogs: { $sum: "$_costRows.cost" },
      },
    },
  ];
}

class DashboardService {
  constructor(client) {
    this.client = client;
    this.db = client.db();
  }
  aggregate(name, pipeline) {
    return this.db
      .collection(name)
      .aggregate(pipeline, { maxTimeMS: 15000 })
      .toArray();
  }

  async financial(p) {
    const statsGroup = {
      $group: {
        _id: null,
        revenue: { $sum: { $multiply: ["$total_price", "$_event.sign"] } },
        cogs: { $sum: { $multiply: ["$_cogs", "$_event.sign"] } },
        missingCosts: sumIf({ $not: ["$_costComplete"] }),
        completedOrders: sumIf({ $eq: ["$_event.sign", 1] }),
        grossSales: {
          $sum: { $cond: [{ $eq: ["$_event.sign", 1] }, "$total_price", 0] },
        },
        returns: sumIf({ $eq: ["$_event.sign", -1] }),
      },
    };
    const [result] = await this.aggregate("orders", [
      // Timeline is the only authoritative completion time. Do not fall back to creation/update.
      { $match: { "timeline.status": { $in: ["completed", "delivered"] } } },
      paymentLookup,
      {
        $set: {
          _completedAt: firstTimeline(["completed", "delivered"]),
          _canceledAt: firstTimeline(["canceled", "cancelled"]),
          _payment: { $arrayElemAt: ["$payments", 0] },
        },
      },
      {
        $set: {
          _reversedAt: {
            $ifNull: [
              "$_canceledAt",
              {
                $cond: [
                  { $eq: ["$_payment.status", "refunded"] },
                  "$_payment.refunded_at",
                  null,
                ],
              },
            ],
          },
        },
      },
      {
        $set: {
          _event: [
            { date: "$_completedAt", sign: 1 },
            { date: "$_reversedAt", sign: -1 },
          ],
        },
      },
      { $unwind: "$_event" },
      {
        $match: {
          "_event.date": range(p.previousStart, p.end),
          $expr: {
            $and: [
              validMoney("$total_price"),
              validDate("$_completedAt"),
              { $gte: ["$_event.date", "$_completedAt"] },
            ],
          },
        },
      },
      ...costStages(),
      {
        $facet: {
          current: [
            { $match: { "_event.date": range(p.start, p.end) } },
            statsGroup,
          ],
          previous: [
            { $match: { "_event.date": range(p.previousStart, p.start) } },
            statsGroup,
          ],
          series: [
            { $match: { "_event.date": range(p.start, p.end) } },
            {
              $group: {
                _id: dateKey("$_event.date", p),
                revenue: {
                  $sum: { $multiply: ["$total_price", "$_event.sign"] },
                },
                cogs: { $sum: { $multiply: ["$_cogs", "$_event.sign"] } },
              },
            },
          ],
        },
      },
    ]);
    const normalize = (row) => {
      const r = {
        revenue: 0,
        cogs: 0,
        completedOrders: 0,
        grossSales: 0,
        missingCosts: 0,
        returns: 0,
        ...row,
      };
      return {
        ...r,
        cogs: r.missingCosts ? null : r.cogs,
        profit: r.missingCosts ? null : r.revenue - r.cogs,
        averageOrderValue: r.completedOrders
          ? r.grossSales / r.completedOrders
          : 0,
        totalExpenses: null,
        cashPaid: null,
        receivables: null,
        payables: null,
      };
    };
    const current = normalize(result?.current[0]),
      previous = normalize(result?.previous[0]);
    const [quality] = await this.aggregate("orders", [
      {
        $match: {
          $or: [
            { status: { $in: ["completed", "delivered"] } },
            { "timeline.status": { $in: ["completed", "delivered"] } },
          ],
        },
      },
      paymentLookup,
      {
        $set: {
          completionDate: firstTimeline(["completed", "delivered"]),
          canceledDate: firstTimeline(["canceled", "cancelled"]),
          _payment: { $arrayElemAt: ["$payments", 0] },
        },
      },
      {
        $group: {
          _id: null,
          missingCompletionDates: sumIf({
            $not: [validDate("$completionDate")],
          }),
          invalidAmounts: sumIf({ $not: [validMoney("$total_price")] }),
          missingReversalDates: sumIf({
            $and: [
              { $in: ["$status", ["canceled", "cancelled"]] },
              { $not: [validDate("$canceledDate")] },
              { $not: [validDate("$_payment.refunded_at")] },
            ],
          }),
        },
      },
    ]);
    return {
      ...current,
      previous,
      revenueGrowth: growth(current.revenue, previous.revenue),
      cogsGrowth:
        current.cogs === null || previous.cogs === null
          ? null
          : growth(current.cogs, previous.cogs),
      profitGrowth:
        current.profit === null || previous.profit === null
          ? null
          : growth(current.profit, previous.profit),
      missingCompletionDates: quality?.missingCompletionDates || 0,
      missingReversalDates: quality?.missingReversalDates || 0,
      invalidAmounts: quality?.invalidAmounts || 0,
      series: fillSeries(result?.series || [], p, {
        costsComplete: !current.missingCosts,
      }),
    };
  }

  async cash(p) {
    const [result] = await this.aggregate("payments", [
      {
        $match: {
          status: { $in: ["completed", "refund_pending", "refunded"] },
        },
      },
      {
        $set: {
          _events: [
            { date: "$paid_at", kind: "received" },
            {
              date: {
                $cond: [{ $eq: ["$status", "refunded"] }, "$refunded_at", null],
              },
              kind: "refunded",
            },
          ],
        },
      },
      { $unwind: "$_events" },
      {
        $match: {
          "_events.date": range(p.start, p.end),
          $expr: {
            $and: [
              validMoney("$amount"),
              { $in: [{ $ifNull: ["$currency", "VND"] }, ["VND"]] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          received: {
            $sum: {
              $cond: [{ $eq: ["$_events.kind", "received"] }, "$amount", 0],
            },
          },
          refunded: {
            $sum: {
              $cond: [{ $eq: ["$_events.kind", "refunded"] }, "$amount", 0],
            },
          },
        },
      },
    ]);
    const [quality] = await this.aggregate("payments", [
      {
        $match: {
          status: { $in: ["completed", "refund_pending", "refunded"] },
        },
      },
      {
        $match: {
          $expr: {
            $or: [
              { $not: [validDate("$paid_at")] },
              { $not: [validMoney("$amount")] },
              { $not: [{ $in: [{ $ifNull: ["$currency", "VND"] }, ["VND"]] }] },
              {
                $and: [
                  { $eq: ["$status", "refunded"] },
                  { $not: [validDate("$refunded_at")] },
                ],
              },
            ],
          },
        },
      },
      { $count: "count" },
    ]);
    return {
      received: result?.received || 0,
      refunded: result?.refunded || 0,
      net: (result?.received || 0) - (result?.refunded || 0),
      incompletePayments: quality?.count || 0,
    };
  }

  async orders(p) {
    const [result] = await this.aggregate("orders", [
      { $match: { created_at: range(p.previousStart, p.end) } },
      { $set: { _status: statusExpression("$status") } },
      {
        $facet: {
          current: [
            { $match: { created_at: range(p.start, p.end) } },
            { $group: { _id: "$_status", count: { $sum: 1 } } },
          ],
          previous: [
            { $match: { created_at: range(p.previousStart, p.start) } },
            { $count: "count" },
          ],
        },
      },
    ]);
    const statuses = Object.entries(ORDER_LABELS).map(([status, label]) => ({
      status,
      label,
      count: result?.current.find((row) => row._id === status)?.count || 0,
    }));
    // Include unexpected historical statuses without inventing business enums.
    for (const row of result?.current || [])
      if (!ORDER_LABELS[row._id])
        statuses.push({
          status: row._id || "unknown",
          label: row._id || "Chưa rõ",
          count: row.count,
        });
    const total = statuses.reduce((sum, row) => sum + row.count, 0);
    const currentMatch = {
      status: {
        $in: [
          "pending",
          "processing",
          "confirmed",
          "cancel_pending",
          "awaiting_payment",
        ],
      },
    };
    const [attention] = await this.aggregate("orders", [
      { $match: currentMatch },
      {
        $facet: {
          count: [{ $count: "count" }],
          pending: [{ $match: { status: "pending" } }, { $count: "count" }],
          items: [
            { $sort: { created_at: -1, _id: -1 } },
            { $limit: 6 },
            {
              $project: {
                status: 1,
                total_price: 1,
                created_at: 1,
                customer: {
                  $ifNull: [
                    "$shipping_address_snapshot.full_name",
                    "$shipping_address_snapshot.fullName",
                  ],
                },
                subscriptionId: 1,
              },
            },
          ],
        },
      },
    ]);
    const reconciliation = await this.aggregate("payments", [
      {
        $match: {
          status: { $in: ["capture_unknown", "refund_pending", "failed"] },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const intents = await this.aggregate("payment_intents", [
      { $match: { status: { $in: ["capture_unknown", "capturing"] } } },
      {
        $lookup: {
          from: "payments",
          localField: "paypalOrderId",
          foreignField: "transaction_id",
          as: "payment",
        },
      },
      { $match: { payment: { $size: 0 } } },
      { $count: "count" },
    ]);
    return {
      total,
      growth: growth(total, result?.previous[0]?.count || 0),
      statuses,
      attentionCount: attention?.count[0]?.count || 0,
      pendingNow: attention?.pending[0]?.count || 0,
      attention: attention?.items || [],
      reconciliation:
        reconciliation.reduce((sum, row) => sum + row.count, 0) +
        (intents[0]?.count || 0),
      reconciliationStatuses: reconciliation,
      unlinkedIntents: intents[0]?.count || 0,
    };
  }

  async inventory(now) {
    const [products] = await this.aggregate("products", [
      { $match: PUBLIC_PRODUCT_FILTER },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          unlinked: sumIf({
            $eq: [{ $ifNull: ["$inventoryItemId", null] }, null],
          }),
        },
      },
    ]);
    const [stock] = await this.aggregate("inventory_items", [
      ...require("../utils/warehouse-product.util").warehouseProductStages(),
      {
        $match: { $or: [{ status: "active" }, { status: { $exists: false } }] },
      },
      buildBatchStockLookup("_id", "_stock", now),
      {
        $lookup: {
          from: "inventory_summaries",
          localField: "_id",
          foreignField: "inventoryItemId",
          as: "_summary",
        },
      },
      {
        $set: {
          available: {
            $ifNull: [{ $arrayElemAt: ["$_stock.availableQuantity", 0] }, 0],
          },
          threshold: {
            $ifNull: [
              { $arrayElemAt: ["$_summary.minQuantity", 0] },
              { $ifNull: ["$minQuantity", 10] },
            ],
          },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                skus: { $sum: 1 },
                outOfStock: sumIf({ $lte: ["$available", 0] }),
                lowStock: sumIf({
                  $and: [
                    { $gt: ["$available", 0] },
                    { $lt: ["$available", "$threshold"] },
                  ],
                }),
              },
            },
          ],
          alerts: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $lte: ["$available", 0] },
                    { $lt: ["$available", "$threshold"] },
                  ],
                },
              },
            },
            { $sort: { available: 1, itemCode: 1 } },
            { $limit: 5 },
            {
              $project: {
                itemName: 1,
                itemCode: 1,
                unit: 1,
                available: 1,
                threshold: 1,
              },
            },
          ],
        },
      },
    ]);
    const [value] = await this.aggregate("inventory_batches", [
      { $match: { quantity: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          value: {
            $sum: { $multiply: ["$quantity", numeric("$importPrice")] },
          },
          missingCosts: sumIf({ $not: [validMoney("$importPrice")] }),
        },
      },
    ]);
    const expiry = new ExpiryMonitoringService(this.client);
    const [expirySummary, expiryList] = await Promise.all([
      expiry.summary(now),
      expiry.list({ limit: 5, status: "urgent" }, now),
    ]);
    return {
      products: products?.count || 0,
      unlinkedProducts: products?.unlinked || 0,
      skus: 0,
      lowStock: 0,
      outOfStock: 0,
      ...stock?.totals[0],
      value: value?.missingCosts ? null : value?.value || 0,
      missingCosts: value?.missingCosts || 0,
      alerts: stock?.alerts || [],
      expiry: expirySummary,
      expiring: expiryList.data.map(
        ({ _id, batchNumber, itemName, expiryDate, quantity, unit }) => ({
          _id,
          batchNumber,
          itemName,
          expiryDate,
          quantity,
          unit,
        }),
      ),
    };
  }

  async purchases(p) {
    const [result] = await this.aggregate("purchase_orders", [
      { $match: { status: "imported", importedAt: range(p.start, p.end) } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                value: { $sum: "$totalAmount" },
                invalidAmounts: sumIf({ $not: [validMoney("$totalAmount")] }),
              },
            },
          ],
          series: [
            {
              $group: {
                _id: dateKey("$importedAt", p),
                value: { $sum: "$totalAmount" },
                invalidAmounts: sumIf({ $not: [validMoney("$totalAmount")] }),
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);
    return {
      count: result?.totals[0]?.count || 0,
      value: result?.totals[0]?.invalidAmounts
        ? null
        : result?.totals[0]?.value || 0,
      invalidAmounts: result?.totals[0]?.invalidAmounts || 0,
      series: (result?.series || []).map((row) => ({
        ...row,
        value: row.invalidAmounts ? null : row.value,
      })),
      paid: null,
    };
  }

  async subscriptions(p, now) {
    const today = new Date(`${localDay(now)}T00:00:00+07:00`),
      tomorrow = new Date(+today + DAY),
      nextWeek = new Date(+today + 7 * DAY);
    const [subs] = await this.aggregate("subscriptions", [
      {
        $group: {
          _id: null,
          active: sumIf({ $eq: ["$status", "active"] }),
          created: sumIf(inPeriod("$createdAt", p.start, p.end)),
        },
      },
    ]);
    const base = [
      {
        $lookup: {
          from: "subscriptions",
          localField: "subscriptionId",
          foreignField: "_id",
          as: "_sub",
        },
      },
      { $set: { _sub: { $arrayElemAt: ["$_sub", 0] } } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "_order",
        },
      },
      { $set: { _order: { $arrayElemAt: ["$_order", 0] } } },
      {
        $set: {
          _live: {
            $and: [
              { $ne: ["$status", "skipped"] },
              {
                $or: [
                  { $eq: ["$_sub.status", "active"] },
                  { $ne: [{ $ifNull: ["$orderId", null] }, null] },
                ],
              },
            ],
          },
          _done: { $in: ["$_order.status", ["completed", "delivered"]] },
        },
      },
    ];
    const [runs] = await this.aggregate("subscription_runs", [
      ...base,
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                today: sumIf({
                  $and: ["$_live", inPeriod("$scheduledDate", today, tomorrow)],
                }),
                next7days: sumIf({
                  $and: ["$_live", inPeriod("$scheduledDate", today, nextWeek)],
                }),
                preparing: sumIf({
                  $and: [
                    "$_live",
                    inPeriod("$scheduledDate", p.start, p.end),
                    {
                      $or: [
                        { $in: ["$status", ["scheduled", "processing"]] },
                        {
                          $in: [
                            "$_order.status",
                            ["pending", "processing", "confirmed"],
                          ],
                        },
                      ],
                    },
                  ],
                }),
                completed: sumIf({
                  $and: ["$_done", inPeriod("$scheduledDate", p.start, p.end)],
                }),
                awaitingCustomer: sumIf({
                  $and: [
                    "$_live",
                    inPeriod("$scheduledDate", p.start, p.end),
                    {
                      $in: [
                        "$status",
                        ["pending_confirmation", "pending_payment"],
                      ],
                    },
                  ],
                }),
                failed: sumIf({
                  $and: [
                    "$_live",
                    inPeriod("$scheduledDate", p.start, p.end),
                    { $eq: ["$status", "failed"] },
                  ],
                }),
                overdue: sumIf({
                  $and: [
                    "$_live",
                    { $lt: ["$scheduledDate", today] },
                    { $not: ["$_done"] },
                    {
                      $not: [
                        { $in: ["$_order.status", ["canceled", "cancelled"]] },
                      ],
                    },
                  ],
                }),
              },
            },
          ],
          upcoming: [
            {
              $match: {
                scheduledDate: range(today, nextWeek),
                _live: true,
                _done: false,
                "_order.status": { $nin: ["canceled", "cancelled"] },
              },
            },
            { $sort: { scheduledDate: 1, _id: 1 } },
            { $limit: 6 },
            {
              $project: {
                subscriptionId: 1,
                orderId: 1,
                scheduledDate: 1,
                wishDate: 1,
                status: 1,
                orderStatus: "$_order.status",
                code: "$_sub.code",
                customer: "$_sub.shippingAddress.full_name",
                occurrenceNumber: 1,
              },
            },
          ],
        },
      },
    ]);
    return {
      active: subs?.active || 0,
      created: subs?.created || 0,
      preorder: null,
      today: 0,
      next7days: 0,
      preparing: 0,
      awaitingCustomer: 0,
      completed: 0,
      failed: 0,
      overdue: 0,
      ...runs?.totals[0],
      upcoming: runs?.upcoming || [],
    };
  }

  async sales(p) {
    const base = [
      { $match: { status: { $in: ["completed", "delivered"] } } },
      paymentLookup,
      { $match: { "payments.status": { $nin: ["refunded"] } } },
      { $set: { _completedAt: firstTimeline(["completed", "delivered"]) } },
      { $match: { _completedAt: range(p.start, p.end) } },
    ];
    const [result] = await this.aggregate("orders", [
      ...base,
      {
        $facet: {
          products: [
            { $unwind: "$items" },
            {
              $group: {
                _id: { $ifNull: ["$items.product_id", "$items.productId"] },
                name: {
                  $first: { $ifNull: ["$items.name", "$items.productName"] },
                },
                quantity: { $sum: "$items.quantity" },
              },
            },
            { $sort: { quantity: -1, _id: 1 } },
            { $limit: 5 },
          ],
          categories: [
            { $unwind: "$items" },
            {
              $set: {
                _itemGross: {
                  $ifNull: [
                    "$items.subtotal",
                    { $multiply: ["$items.price", "$items.quantity"] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: { $ifNull: ["$items.category_id", "$items.categoryId"] },
                grossSales: { $sum: "$_itemGross" },
              },
            },
            { $sort: { grossSales: -1, _id: 1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "_category",
              },
            },
            {
              $project: {
                grossSales: 1,
                name: {
                  $ifNull: [
                    { $arrayElemAt: ["$_category.name", 0] },
                    "Chưa phân loại",
                  ],
                },
              },
            },
          ],
          customers: [
            { $match: { user_id: { $ne: null } } },
            { $group: { _id: "$user_id" } },
            {
              $lookup: {
                from: "orders",
                let: { uid: "$_id" },
                pipeline: [
                  {
                    $match: {
                      status: { $in: ["completed", "delivered"] },
                      $expr: { $eq: ["$user_id", "$$uid"] },
                    },
                  },
                  paymentLookup,
                  { $match: { "payments.status": { $nin: ["refunded"] } } },
                  {
                    $set: { _date: firstTimeline(["completed", "delivered"]) },
                  },
                  { $match: { _date: { $type: "date", $lt: p.start } } },
                  { $limit: 1 },
                  { $project: { _id: 1 } },
                ],
                as: "_previous",
              },
            },
            {
              $group: {
                _id: null,
                transacting: { $sum: 1 },
                returning: sumIf({ $gt: [{ $size: "$_previous" }, 0] }),
              },
            },
          ],
        },
      },
    ]);
    const customers = result?.customers[0] || { transacting: 0, returning: 0 };
    return {
      products: result?.products || [],
      categories: result?.categories || [],
      ...customers,
      returningRate: customers.transacting
        ? (customers.returning / customers.transacting) * 100
        : null,
    };
  }

  async overview(query, user, now = new Date()) {
    const period = resolvePeriod(query, now);
    const access = {
      orders: hasPermission(user, ["order:read:any"]),
      inventory: hasPermission(user, ["inventory:manage"]),
      purchases: hasPermission(user, ["purchase-order:manage"]),
      users: hasPermission(user, ["user:read"]),
    };
    const sections = {},
      errors = [];
    const tasks = [
      ["financial", access.orders, () => this.financial(period)],
      ["cash", access.orders, () => this.cash(period)],
      ["orders", access.orders, () => this.orders(period)],
      ["subscriptions", access.orders, () => this.subscriptions(period, now)],
      ["sales", access.orders, () => this.sales(period)],
      ["inventory", access.inventory, () => this.inventory(now)],
      ["purchases", access.purchases, () => this.purchases(period)],
      [
        "customers",
        access.users,
        async () => {
          const [r] = await this.aggregate("users", [
            {
              $match: {
                role: "user",
                created_at: range(period.start, period.end),
              },
            },
            { $count: "new" },
          ]);
          return { new: r?.new || 0 };
        },
      ],
    ];
    await Promise.all(
      tasks.map(async ([key, permitted, work]) => {
        sections[key] = null;
        if (!permitted) return;
        try {
          sections[key] = await work();
        } catch (error) {
          console.error(`Dashboard ${key}:`, error.message);
          errors.push(key);
        }
      }),
    );
    return {
      period,
      generatedAt: now,
      access,
      errors,
      ...sections,
      limitations: [
        "Tổng chi phí, tiền chi nhà cung cấp, chi phí vận hành và công nợ chưa có sổ ghi nhận để thống kê.",
        "Lợi nhuận tạm tính = doanh thu ghi nhận − giá vốn phân bổ lô; chưa trừ chi phí vận hành và giao hàng thực tế.",
        "Chỉ ghi nhận doanh thu theo mốc hoàn thành trong timeline; hủy/hoàn sau hoàn thành đảo doanh thu và giá vốn tại mốc hủy hoặc hoàn tiền. Đơn thiếu mốc thời gian bị loại và cảnh báo.",
        "Tiền thu/hoàn dùng paid_at/refunded_at và amount VND. Không suy ra thu COD từ trạng thái giao hàng; tiền thu chưa gồm phí PayPal hay đối soát ngân hàng.",
        "Intent PayPal đang đối soát chưa có payment không được cộng vào tiền thu; cảnh báo riêng, vì chưa có màn hình quản lý intent độc lập.",
        "Top danh mục là tiền hàng trước giảm giá và phí vận chuyển của đơn hiện còn hoàn thành; chưa phân bổ voucher theo danh mục.",
        "Chưa có nghiệp vụ đơn đặt trước độc lập. Ngày mong muốn của kỳ giao là mốc lập lịch, chưa có giờ hẹn hoặc bằng chứng giao trễ; cảnh báo quá hạn chỉ so ngày mong muốn với trạng thái hiện tại.",
      ],
    };
  }
}

module.exports = DashboardService;
