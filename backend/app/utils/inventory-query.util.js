const { ObjectId } = require("mongodb");

const FEFO_SORT = { expiryDate: 1, createdAt: 1 };

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function buildAvailableBatchFefoFilter(inventoryItemId, now = new Date()) {
  const itemId = toObjectId(inventoryItemId);

  return {
    inventoryItemId: itemId,
    status: "available",
    quantity: { $gt: 0 },
    expiryDate: { $gte: now },
  };
}

module.exports = {
  FEFO_SORT,
  buildAvailableBatchFefoFilter,
  toObjectId,
};
