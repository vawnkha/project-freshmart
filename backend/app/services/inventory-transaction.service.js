const InventoryTransactionRepository = require("../repositories/inventory-transaction.repository");

class InventoryTransactionService {
  constructor(client) {
    this.repository = new InventoryTransactionRepository(client);
  }

  buildFilter(query = {}) {
    const filter = {};
    if (query.type) filter.type = query.type;
    if (query.inventoryItemId) {
      filter.inventoryItemId = this.repository.toObjectId(query.inventoryItemId);
    }
    return filter;
  }

  async find(query = {}) {
    return this.repository.findList(this.buildFilter(query), {
      sort: { createdAt: -1 },
    });
  }

  async findById(id) {
    return this.repository.findById(id);
  }

  async findByInventoryItemId(inventoryItemId) {
    return this.repository.findByInventoryItemId(inventoryItemId, {
      sort: { createdAt: -1 },
    });
  }
}

module.exports = InventoryTransactionService;
