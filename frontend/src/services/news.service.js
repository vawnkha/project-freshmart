import api from "./api.service";

class NewsService {
  constructor(baseUrl = "/api/news") {
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

  async getPublicNews(params = {}) {
    return this.getPublic(params);
  }

  async getPublicBySlug(slug) {
    const res = await this.api.get(`/public/${slug}`);
    return res.data;
  }

  async getPublicNewsBySlug(slug) {
    return this.getPublicBySlug(slug);
  }
}

export default new NewsService();
