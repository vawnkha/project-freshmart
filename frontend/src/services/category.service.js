import api from "./api.service";

function isFormData(payload) {
  return typeof FormData !== "undefined" && payload instanceof FormData;
}

class CategoryService {
  constructor(baseUrl = "/api/categories") {
    this.api = api(baseUrl);
  }

  async getAll(params = {}) {
    const res = await this.api.get("/", { params });
    return res.data;
  }

  async getBySlug(slug) {
    const res = await this.api.get(`/${slug}`);
    return res.data;
  }

  async getById(id) {
    const res = await this.api.get(`/${id}`);
    return res.data;
  }

  async create(payload) {
    const config = isFormData(payload)
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const res = await this.api.post("/", payload, config);
    return res.data;
  }

  async update(id, payload) {
    const config = isFormData(payload)
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const res = await this.api.put(`/${id}`, payload, config);
    return res.data;
  }

  async remove(id) {
    const res = await this.api.delete(`/${id}`);
    return res.data;
  }

  async delete(id) {
    return this.remove(id);
  }
}

export default new CategoryService();
