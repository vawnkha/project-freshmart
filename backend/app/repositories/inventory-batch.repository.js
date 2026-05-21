const BaseRepository = require("./base.repository");

class InventoryBatchRepository extends BaseRepository {
  constructor(client) {
    super(client, "inventory_batches");
  }

  findByInventoryItemId(inventoryItemId, options = {}) {
    const itemId = this.toObjectId(inventoryItemId);
    return this.findList({ inventoryItemId: itemId }, options);
  }
}

module.exports = InventoryBatchRepository;
