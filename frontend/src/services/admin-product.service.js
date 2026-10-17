import api from "./api.service";

class AdminProductService {
  constructor(baseUrl = "/api/admin/products") {
    this.api = api(baseUrl);
  }

  async getAll(params = {}) {
    const res = await this.api.get("/", { params });
    return res.data;
  }

  async createFromInventory(inventoryItemId, payload) {
    const res = await this.api.post(
      `/from-inventory/${inventoryItemId}`,
      payload,
    );
    return res.data;
  }
}

export default new AdminProductService();
