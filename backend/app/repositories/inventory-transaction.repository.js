const BaseRepository = require("./base.repository");

class InventoryTransactionRepository extends BaseRepository {
  constructor(client) {
    super(client, "inventory_transactions");
  }

  findByInventoryItemId(inventoryItemId, options = {}) {
    const itemId = this.toObjectId(inventoryItemId);
    return this.findList({ inventoryItemId: itemId }, options);
  }
}

module.exports = InventoryTransactionRepository;
