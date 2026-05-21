const ApiError = require("../api-error");
const InventoryBatchRepository = require("../repositories/inventory-batch.repository");

class InventoryBatchService {
  constructor(client) {
    this.repository = new InventoryBatchRepository(client);
  }

  buildFilter(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.inventoryItemId) {
      filter.inventoryItemId = this.repository.toObjectId(query.inventoryItemId);
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

  async lock(id) {
    const batch = await this.repository.updateById(id, {
      status: "locked",
      updatedAt: new Date(),
    });
    if (!batch) throw new ApiError(404, "Khong tim thay lo hang");
    return batch;
  }

  async unlock(id) {
    const batch = await this.repository.updateById(id, {
      status: "available",
      updatedAt: new Date(),
    });
    if (!batch) throw new ApiError(404, "Khong tim thay lo hang");
    return batch;
  }
}

module.exports = InventoryBatchService;
