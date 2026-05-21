import api from "./api.service";

class AdminProductService {
  constructor(baseUrl = "/api/admin/products") {
    this.api = api(baseUrl);
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
