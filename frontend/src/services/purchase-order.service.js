import api from "./api.service";

class PurchaseOrderService {
  constructor(baseUrl = "/api/purchase-orders") {
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

  async create(payload) {
    const res = await this.api.post("/", payload);
    return res.data;
  }

  async update(id, payload) {
    const res = await this.api.put(`/${id}`, payload);
    return res.data;
  }

  async confirmImport(id) {
    const res = await this.api.post(`/${id}/confirm-import`);
    return res.data;
  }

  async cancel(id) {
    const res = await this.api.patch(`/${id}/cancel`);
    return res.data;
  }
}

export default new PurchaseOrderService();
