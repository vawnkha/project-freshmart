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

  async uploadBannerImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const res = await this.api.post("/banners", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }

  async uploadNewsImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const res = await this.api.post("/news", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }
}

export default new UploadService();
