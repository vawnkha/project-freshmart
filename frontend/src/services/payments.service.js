import api from "./api.service";

class PaymentService {
  constructor(baseUrl = "/api/payment") {
    this.api = api(baseUrl);
  }

  async createPaypalOrder(payload) {
    const res = await this.api.post("/create-order", payload);
    return res.data;
  }

  async getConfig() {
    return (await this.api.get("/config")).data;
  }

  async capturePaypalOrder(payload) {
    const res = await this.api.post("/capture-order", payload);
    return res.data;
  }
}

export default new PaymentService();
