import api from "./api.service";

class AuthService {
  constructor(baseUrl = "/api/auth") {
    this.api = api(baseUrl);
  }

  async login(data) {
    const res = await this.api.post("/login", data);
    return res.data;
  }

  async forgotPassword(email) {
    const res = await this.api.post("/forgot-password", { email });
    return res.data;
  }

  async resetPassword(userId, token, newPassword) {
    const res = await this.api.post(`/reset-password/${userId}/${token}`, {
      newPassword,
    });
    return res.data;
  }

  async changePassword(oldPassword, newPassword) {
    return (await this.api.post("/change-password", {
      oldPassword,
      newPassword,
    })).data;
  }
}

export default new AuthService();
