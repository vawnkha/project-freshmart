import createApiClient from "./api.service";

class NotificationService {
  constructor(baseUrl = "/api/notifications") {
    this.api = createApiClient(baseUrl);
  }

  async getAll(params = {}) {
    return (await this.api.get("/", { params })).data;
  }

  async get(id) {
    return (await this.api.get(`/${id}`)).data;
  }

  async create(data) {
    return (await this.api.post("/", data)).data;
  }

  async update(id, data) {
    return (await this.api.patch(`/${id}`, data)).data;
  }

  async getUnreadCount() {
    return (await this.api.get("/unread-count")).data;
  }

  async getMine() {
    return (await this.api.get("/mine")).data;
  }

  async getMineUnreadCount() {
    return (await this.api.get("/mine/unread-count")).data;
  }

  async markMineAsRead(id) {
    return (await this.api.patch(`/mine/${id}/read`)).data;
  }

  async markAsRead(id) {
    return (await this.api.patch(`/${id}/read`)).data;
  }

  async markAllAsRead(params = {}) {
    return (await this.api.patch("/mark-all-read", null, { params })).data;
  }

  async remove(id) {
    return (await this.api.delete(`/${id}`)).data;
  }

  async removeMany(ids = []) {
    return (await this.api.delete("/bulk-delete", { data: { ids } })).data;
  }

  async removeAll(params = {}) {
    return (await this.api.delete("/", { params })).data;
  }
}

export default new NotificationService();
