const ApiError = require("../api-error");
const {
  toObjectId,
  EMPTY_STOCK,
  buildBatchStockGroup,
  isInventoryItemActive,
} = require("../utils/inventory-query.util");

// Batches are the source of truth. Summaries are only a reporting cache.
class InventoryStockService {
  constructor(client) {
    this.client = client;
    const db = client.db();
    this.Item = db.collection("inventory_items");
    this.Batch = db.collection("inventory_batches");
    this.Summary = db.collection("inventory_summaries");
  }

  async getTotals(inventoryItemId, { session, now = new Date() } = {}) {
    const itemId = toObjectId(inventoryItemId);
    if (!itemId) throw new ApiError(400, "inventoryItemId khong hop le");
    const [totals] = await this.Batch.aggregate(
      [
        { $match: { inventoryItemId: itemId, quantity: { $gt: 0 } } },
        buildBatchStockGroup(now),
      ],
      { session },
    ).toArray();
    return { ...EMPTY_STOCK, ...totals, inventoryItemId: itemId };
  }

  async getAvailableStock(inventoryItemId, options = {}) {
    const item = await this.Item.findOne(
      { _id: toObjectId(inventoryItemId) },
      { session: options.session },
    );
    if (!isInventoryItemActive(item)) return 0;
    return (await this.getTotals(inventoryItemId, options)).availableQuantity;
  }

  async syncSummary(inventoryItemId, options = {}) {
    const itemId = toObjectId(inventoryItemId);
    const item = await this.Item.findOne(
      { _id: itemId },
      { session: options.session },
    );
    if (!item) throw new ApiError(404, "Hang kho khong ton tai");
    const { _id, ...totals } = await this.getTotals(itemId, options);
    await this.Summary.updateOne(
      { inventoryItemId: itemId },
      {
        $set: {
          ...totals,
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit,
          updatedAt: new Date(),
        },
        $setOnInsert: { minQuantity: Number(item.minQuantity ?? 10) },
      },
      { upsert: true, session: options.session },
    );
    return this.Summary.findOne(
      { inventoryItemId: itemId },
      { session: options.session },
    );
  }

  async withTransaction(options, callback) {
    if (options?.session) return callback(options.session);
    const session = this.client.startSession();
    try {
      return await session.withTransaction(() => callback(session));
    } finally {
      await session.endSession();
    }
  }

  // Serialize mutations for an item, including mutations of different batches.
  // A transaction retry re-reads the batches after a concurrent lock/export.
  async acquireItem(inventoryItemId, session, { requireActive = false } = {}) {
    if (!session?.inTransaction())
      throw new ApiError(500, "Inventory mutation requires a transaction");
    const item = await this.Item.findOneAndUpdate(
      { _id: toObjectId(inventoryItemId) },
      {
        $inc: { stockVersion: 1 },
      },
      { session, returnDocument: "after" },
    );
    if (!item) throw new ApiError(404, "Hang kho khong ton tai");
    if (requireActive && !isInventoryItemActive(item))
      throw new ApiError(409, "Hang kho khong hoat dong");
    return item;
  }
}

module.exports = InventoryStockService;
