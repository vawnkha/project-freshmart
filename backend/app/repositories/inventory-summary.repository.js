const BaseRepository = require("./base.repository");

class InventorySummaryRepository extends BaseRepository {
  constructor(client) {
    super(client, "inventory_summaries");
  }

  findByInventoryItemId(inventoryItemId) {
    const itemId = this.toObjectId(inventoryItemId);
    return this.findOne({ inventoryItemId: itemId });
  }
}

module.exports = InventorySummaryRepository;
