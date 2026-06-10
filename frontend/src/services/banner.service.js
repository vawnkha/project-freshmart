import api from "./api.service";

class BannerService {
  constructor(baseUrl = "/api/banners") {
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

  async remove(id) {
    const res = await this.api.delete(`/${id}`);
    return res.data;
  }

  async getPublic(params = {}) {
    const res = await this.api.get("/public", { params });
    return res.data;
  }

  async getPublicBanners(position) {
    const params = position ? { position } : {};
    return this.getPublic(params);
  }
}

export default new BannerService();
