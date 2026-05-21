import api from "./api.service";

class UploadService {
  constructor(baseUrl = "/api/uploads") {
    this.api = api(baseUrl);
  }

  async uploadProductImages(formData) {
    const res = await this.api.post("/products", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }
}

export default new UploadService();
