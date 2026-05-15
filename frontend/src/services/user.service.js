import api from "./api.service";

class UserService {
  constructor(baseUrl = "/api/users") {
    this.api = api(baseUrl);
  }

  async register(data) {
    const res = await this.api.post("/", data);
    return res.data;
  }

  async activateAccount(userId, token) {
    const res = await this.api.get(`/activate/${userId}`, {
      params: { token },
    });
    return res.data;
  }

  async getAll(params = {}) {
    const res = await this.api.get("/", { params });
    return res.data;
  }

  async getUserById(id) {
    const res = await this.api.get(`/${id}`);
    return res.data;
  }

  async getProfile() {
    return (await this.api.get("/me")).data;
  }

  async updateUser(id, data) {
    const res = await this.api.put(`/${id}`, data);
    return res.data;
  }

  async deleteUser(id) {
    const res = await this.api.delete(`/${id}`);
    return res.data;
  }

  async updateAvatar(id, file) {
    const formData = new FormData();
    formData.append("avatar", file);

    const res = await this.api.put(`/${id}/avatar`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  }
}

export default new UserService();
