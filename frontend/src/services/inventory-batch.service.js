import api from "./api.service";

class InventoryBatchService {
  constructor(baseUrl = "/api/inventory-batches") {
    this.api = api(baseUrl);
  }

  async getAll(params = {}) {
    const res = await this.api.get("/", { params });
    return res.data;
  }

  async getById(id) {
    const res = await this.api.get(`/${id}`);
    return res.data;
  }

  async lock(id) {
    const res = await this.api.patch(`/${id}/lock`);
    return res.data;
  }

  async unlock(id) {
    const res = await this.api.patch(`/${id}/unlock`);
    return res.data;
  }
}

export default new InventoryBatchService();
