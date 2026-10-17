const ApiError = require("../api-error");
const InventoryBatchRepository = require("../repositories/inventory-batch.repository");
const InventoryStockService = require("./inventory-stock.service");

class InventoryBatchService {
  constructor(client) {
    this.repository = new InventoryBatchRepository(client);
    this.stockService = new InventoryStockService(client);
  }

  buildFilter(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.inventoryItemId) {
      filter.inventoryItemId = this.repository.toObjectId(
        query.inventoryItemId,
      );
    }
    return filter;
  }

  async find(query = {}) {
    return this.repository.findList(this.buildFilter(query), {
      sort: { expiryDate: 1, createdAt: 1 },
    });
  }

  async findById(id) {
    return this.repository.findById(id);
  }

  async setLocked(id, locked) {
    return this.stockService.withTransaction({}, async (session) => {
      const current = await this.repository.findById(id, { session });
      if (!current) throw new ApiError(404, "Khong tim thay lo hang");
      await this.stockService.acquireItem(current.inventoryItemId, session);
      const expired =
        current.expiryDate && new Date(current.expiryDate) < new Date();
      const status = locked
        ? "locked"
        : expired
          ? "expired"
          : Number(current.quantity) > 0
            ? "available"
            : "sold_out";
      const batch = await this.repository.updateById(
        id,
        {
          status,
          updatedAt: new Date(),
        },
        { session },
      );
      await this.stockService.syncSummary(current.inventoryItemId, { session });
      return batch;
    });
  }

  async lock(id) {
    return this.setLocked(id, true);
  }

  async unlock(id) {
    return this.setLocked(id, false);
  }
}

module.exports = InventoryBatchService;
