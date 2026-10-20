import api from "./api.service";

class OrdersService {
  constructor(baseUrl = "/api/order") {
    this.api = api(baseUrl);
  }

  async create(data) {
    const res = await this.api.post("/", data);
    return res.data;
  }

  async getAll() {
    const res = await this.api.get("/all");
    return res.data;
  }

  async getByUser(userId) {
    const res = await this.api.get("/", {
      params: { userId },
    });
    return res.data;
  }

  async getById(id) {
    const res = await this.api.get(`/${id}`);
    return res.data;
  }

  async cancel(id) {
    const res = await this.api.patch(`/${id}/cancel`);
    return res.data;
  }
  async returnReceived(id, reason) {
    return (await this.api.post(`/${id}/return-received`, { reason, received: true })).data;
  }

  async complete(id) {
    const res = await this.api.patch(`/${id}/complete`);
    return res.data;
  }

  async updateStatus(id, data) {
    const res = await this.api.patch(`/${id}/status`, data);
    return res.data;
  }

  async sendInvoice(id) {
    return (await this.api.post(`/${id}/send-invoice`)).data;
  }
}

export default new OrdersService();
