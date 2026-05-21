import api from "./api.service";

class InventoryTransactionService {
  constructor(baseUrl = "/api/inventory-transactions") {
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

  async getByItem(inventoryItemId) {
    const res = await this.api.get(`/by-item/${inventoryItemId}`);
    return res.data;
  }
}

export default new InventoryTransactionService();
