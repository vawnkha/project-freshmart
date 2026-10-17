const InventorySummaryRepository = require("../repositories/inventory-summary.repository");
const {
  buildBatchStockLookup,
  EMPTY_STOCK,
} = require("../utils/inventory-query.util");

class InventorySummaryService {
  constructor(client) {
    this.repository = new InventorySummaryRepository(client);
  }

  async findLive(filter = {}) {
    return this.repository
      .collection()
      .aggregate([
        { $match: filter },
        buildBatchStockLookup(),
        {
          $replaceWith: {
            $mergeObjects: [
              "$$ROOT",
              { $ifNull: [{ $arrayElemAt: ["$batchStock", 0] }, EMPTY_STOCK] },
              { _id: "$_id" },
            ],
          },
        },
        { $project: { batchStock: 0 } },
        { $sort: { updatedAt: -1 } },
      ])
      .toArray();
  }

  async find() {
    return this.findLive();
  }

  async findById(id) {
    return (
      (await this.findLive({ _id: this.repository.toObjectId(id) }))[0] || null
    );
  }

  async findByInventoryItemId(inventoryItemId) {
    return (
      (
        await this.findLive({
          inventoryItemId: this.repository.toObjectId(inventoryItemId),
        })
      )[0] || null
    );
  }
}

module.exports = InventorySummaryService;
