const BaseRepository = require("./base.repository");

class InventoryItemRepository extends BaseRepository {
  constructor(client) {
    super(client, "inventory_items");
  }

  findByItemCode(itemCode) {
    return this.findOne({ itemCode });
  }
}

module.exports = InventoryItemRepository;
