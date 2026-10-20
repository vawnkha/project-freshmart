const { ObjectId } = require("mongodb");
const { nextVietnamMidnight } = require("./expiry.util");

const FEFO_SORT = { fefoExpiry: 1, createdAt: 1, _id: 1 };
const SELLABLE_BATCH_STATUS = "available";
const EMPTY_STOCK = {
  quantity: 0,
  availableQuantity: 0,
  lockedQuantity: 0,
  expiredQuantity: 0,
};

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function buildAvailableBatchFefoFilter(inventoryItemId, now = new Date()) {
  const itemId = toObjectId(inventoryItemId);

  return {
    inventoryItemId: itemId,
    status: SELLABLE_BATCH_STATUS,
    quantity: { $gt: 0 },
    expiryDate: { $type: "date", $gte: nextVietnamMidnight(now) },
  };
}

function buildBatchStockGroup(now = new Date()) {
  const unexpired = {
        $and: [
          { $eq: [{ $type: "$expiryDate" }, "date"] },
          { $gte: ["$expiryDate", nextVietnamMidnight(now)] },
        ],
  };
  return {
    $group: {
      _id: "$inventoryItemId",
      quantity: { $sum: "$quantity" },
      availableQuantity: {
        $sum: {
          $cond: [
            { $and: [{ $eq: ["$status", SELLABLE_BATCH_STATUS] }, unexpired] },
            "$quantity",
            0,
          ],
        },
      },
      lockedQuantity: {
        $sum: {
          $cond: [
            {
              $not: [
                {
                  $in: [
                    "$status",
                    [SELLABLE_BATCH_STATUS, "expired", "sold_out"],
                  ],
                },
              ],
            },
            "$quantity",
            0,
          ],
        },
      },
      expiredQuantity: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ["$status", "expired"] },
                {
                  $and: [
                    { $eq: ["$status", SELLABLE_BATCH_STATUS] },
                    { $not: [unexpired] },
                  ],
                },
              ],
            },
            "$quantity",
            0,
          ],
        },
      },
    },
  };
}

function buildBatchStockLookup(
  localField = "inventoryItemId",
  as = "batchStock",
  now = new Date(),
) {
  return {
    $lookup: {
      from: "inventory_batches",
      let: { itemId: `$${localField}` },
      pipeline: [
        {
          $match: {
            quantity: { $gt: 0 },
            $expr: {
              $and: [
                { $ne: ["$$itemId", null] },
                { $eq: ["$inventoryItemId", "$$itemId"] },
              ],
            },
          },
        },
        buildBatchStockGroup(now),
      ],
      as,
    },
  };
}

function isInventoryItemActive(item) {
  return Boolean(item) && (!item.status || item.status === "active");
}

function isProductSellable(product) {
  return product.inventoryItemId
    ? product.status === "active"
    : !product.status || ["active", "in_stock"].includes(product.status);
}

const PUBLIC_PRODUCT_FILTER = {
  $or: [
    { inventoryItemId: { $ne: null }, status: "active" },
    {
      inventoryItemId: null,
      $or: [
        {
          status: { $in: ["active", "in_stock", "out_stock", "out_of_stock"] },
        },
        { status: { $exists: false } },
      ],
    },
  ],
};

module.exports = {
  FEFO_SORT,
  buildAvailableBatchFefoFilter,
  toObjectId,
  SELLABLE_BATCH_STATUS,
  EMPTY_STOCK,
  buildBatchStockGroup,
  buildBatchStockLookup,
  isInventoryItemActive,
  isProductSellable,
  PUBLIC_PRODUCT_FILTER,
};
