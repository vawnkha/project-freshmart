const InventorySummaryRepository = require("../repositories/inventory-summary.repository");

class InventorySummaryService {
  constructor(client) {
    this.repository = new InventorySummaryRepository(client);
  }

  async find() {
    return this.repository.findList({}, { sort: { updatedAt: -1 } });
  }

  async findById(id) {
    return this.repository.findById(id);
  }

  async findByInventoryItemId(inventoryItemId) {
    return this.repository.findByInventoryItemId(inventoryItemId);
  }
}

module.exports = InventorySummaryService;
