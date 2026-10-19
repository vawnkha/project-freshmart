import api from "./api.service";

class ProductService {
  constructor(baseUrl = "/api/products") {
    this.api = api(baseUrl);
  }

  async getAll(params = {}, options = {}) {
    const res = await this.api.get("/", { params, ...(Array.isArray(params.unit) ? { paramsSerializer: { indexes: null } } : {}), ...(options.signal ? { signal: options.signal } : {}) });
    return res.data;
  }

  async search(params = {}) {
    const res = await this.api.get("/search", { params });
    return res.data;
  }

  async getById(id) {
    const res = await this.api.get(`/${id}`);
    return res.data;
  }

  async getByCategory(categoryId, params = {}) {
    const res = await this.api.get(`/category/${categoryId}`, { params });
    return res.data;
  }

  async create(formData) {
    const res = await this.api.post("/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }

  async update(id, formData) {
    const res = await this.api.put(`/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }

  async delete(id) {
    const res = await this.api.delete(`/${id}`);
    return res.data;
  }
}

export default new ProductService();
