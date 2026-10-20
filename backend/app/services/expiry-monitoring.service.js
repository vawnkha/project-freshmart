const ApiError = require("../api-error");
const { toObjectId } = require("../utils/inventory-query.util");
const { classifyExpiry } = require("../utils/expiry.util");
const config = require("../config/expiry");
const OutboxService = require("./outbox.service");
const TRACKED_STATUSES = ["available", "locked", "expired", "sold_out"];

class ExpiryMonitoringService {
  constructor(client) {
    this.client = client;
    const db = client.db();
    this.Batch = db.collection("inventory_batches");
    this.Notification = db.collection("notifications");
    this.Proposal = db.collection("promotion_proposals");
    this.outbox = new OutboxService(client);
  }
  pipeline(match = {}, now = new Date()) {
    return [
      { $match: match },
      { $lookup: { from: "products", localField: "inventoryItemId", foreignField: "inventoryItemId", as: "products" } },
      { $set: { product: { $arrayElemAt: ["$products", 0] } } },
      { $unset: "products" },
      { $set: { daysRemaining: { $cond: [{ $eq: [{ $type: "$expiryDate" }, "date"] },
        { $dateDiff: { startDate: now, endDate: "$expiryDate", unit: "day", timezone: config.timezone } }, null] } } },
      { $set: { expiryStatus: { $switch: { branches: [
        { case: { $eq: ["$daysRemaining", null] }, then: "unknown" },
        { case: { $lte: ["$daysRemaining", 0] }, then: "expired" },
        { case: { $lte: ["$daysRemaining", config.urgentDays] }, then: "urgent" },
        { case: { $lte: ["$daysRemaining", config.warningDays] }, then: "warning" },
      ], default: "normal" } } } },
    ];
  }
  decorate(batch, now = new Date()) {
    const expiry = classifyExpiry(batch.expiryDate instanceof Date ? batch.expiryDate : null, now);
    return { ...batch, ...expiry, reservedQuantity: 0,
      sellable: batch.status === "available" && batch.quantity > 0 && expiry.daysRemaining > 0 };
  }
  async summary(now = new Date()) {
    const rows = await this.Batch.aggregate([
      ...this.pipeline({ quantity: { $gt: 0 }, status: { $in: TRACKED_STATUSES } }, now),
      { $group: { _id: { status: "$expiryStatus", unit: "$unit" }, batches: { $sum: 1 }, quantity: { $sum: "$quantity" } } },
    ]).toArray();
    const result = { total: 0, normal: 0, warning: 0, urgent: 0, expired: 0, unknown: 0, quantitiesByUnit: {}, config };
    for (const row of rows) {
      result.total += row.batches;
      result[row._id.status] += row.batches;
      const unit = row._id.unit || "chưa xác định";
      if (!Object.hasOwn(result.quantitiesByUnit, unit)) Object.defineProperty(result.quantitiesByUnit, unit, { value: {}, enumerable: true });
      result.quantitiesByUnit[unit][row._id.status] = row.quantity;
    }
    return result;
  }
  async list(query = {}, now = new Date()) {
    const page = Number(query.page || 1), limit = Number(query.limit || 12);
    const match = { quantity: { $gt: 0 }, status: { $in: TRACKED_STATUSES } };
    if (query.inventoryItemId) match.inventoryItemId = toObjectId(query.inventoryItemId);
    const pipeline = this.pipeline(match, now);
    if (query.product_id) pipeline.push({ $match: { "product._id": toObjectId(query.product_id) } });
    if (query.status) pipeline.push({ $match: { expiryStatus: query.status } });
    if (query.keyword) {
      const keyword = String(query.keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pipeline.push({ $match: { $or: ["batchNumber", "itemName", "itemCode", "product.name"].map(key => ({ [key]: { $regex: keyword, $options: "i" } })) } });
    }
    pipeline.push({ $facet: {
      data: [{ $sort: { [query.sort_by || "expiryDate"]: query.sort_order === "desc" ? -1 : 1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
      count: [{ $count: "total" }],
    } });
    const [result] = await this.Batch.aggregate(pipeline).toArray();
    return { data: result.data.map(row => this.decorate(row, now)), total: result.count[0]?.total || 0, page, limit };
  }
  async detail(id, { session, now = new Date() } = {}) {
    const batchId = toObjectId(id);
    if (!batchId) throw new ApiError(400, "Mã lô không hợp lệ");
    const [batch] = await this.Batch.aggregate(this.pipeline({ _id: batchId }, now), { session }).toArray();
    if (!batch) throw new ApiError(404, "Lô hàng không tồn tại");
    const alerts = await this.Notification.find({ type: "inventory_expiry", "data.batchId": String(batchId) }, { session }).sort({ created_at: -1 }).toArray();
    const proposals = await this.Proposal.find({ batchId }, { session }).sort({ createdAt: -1 }).toArray();
    return { ...this.decorate(batch, now), alerts, proposals };
  }
  async checkBatch(batch, { session, now = new Date() } = {}) {
    if (!TRACKED_STATUSES.includes(batch.status) || !(batch.quantity > 0)) return;
    const expiry = classifyExpiry(batch.expiryDate instanceof Date ? batch.expiryDate : null, now);
    if (expiry.expiryStatus === "normal") return;
    const threshold = { warning: config.warningDays, urgent: config.urgentDays, expired: 0, unknown: "unknown" }[expiry.expiryStatus];
    const label = { warning: "Sắp hết hạn", urgent: "Gần hết hạn", expired: "Hết hạn — ngừng bán", unknown: "Thiếu hạn sử dụng — cần rà soát" }[expiry.expiryStatus];
    const product = await this.client.db().collection("products").findOne({ inventoryItemId: batch.inventoryItemId }, { session });
    await this.outbox.enqueue("notification.admin", {
      type: "inventory_expiry", title: `${label}: ${product?.name || batch.itemName}`,
      content: `Lô ${batch.batchNumber}: tồn ${batch.quantity} ${batch.unit || ""}, HSD ${expiry.expiryCalendarDate || "chưa xác định"}, còn ${expiry.daysRemaining ?? "?"} ngày.`,
      data: { batchId: String(batch._id), batchNumber: batch.batchNumber, productName: product?.name || batch.itemName,
        quantity: batch.quantity, unit: batch.unit, ...expiry, threshold, recipientPermission: "notification:manage",
        url: `/admin/inventory-expiry/${batch._id}` },
    }, { session, idempotencyKey: `inventory-expiry:${batch._id}:${expiry.expiryCalendarDate || "unknown"}:${threshold}` });
  }
  async run(now = new Date()) {
    let checked = 0, errors = 0;
    const cursor = this.Batch.find({ quantity: { $gt: 0 }, status: { $in: TRACKED_STATUSES } });
    for await (const batch of cursor) {
      try { await this.checkBatch(batch, { now }); checked++; }
      catch (error) { if (error.code !== 11000) { errors++; console.error("Expiry alert failed", String(batch._id), error.message); } }
    }
    const PromotionProposalService = require("./promotion-proposal.service");
    await new PromotionProposalService(this.client).syncLifecycle(now);
    console.info("Expiry monitoring completed", { checked, errors });
    return { checked, errors };
  }
}
module.exports = ExpiryMonitoringService;
