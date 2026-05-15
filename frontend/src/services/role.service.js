import api from "./api.service";

class RoleService {
  constructor(baseUrl = "/api/rbac") {
    this.api = api(baseUrl);
  }

  async getPermissions() {
    const res = await this.api.get("/permissions");
    return res.data?.data || res.data || [];
  }

  async getRoles() {
    const res = await this.api.get("/roles");
    return res.data?.data || res.data || [];
  }

  async createRole(data) {
    const res = await this.api.post("/roles", data);
    return res.data;
  }

  async updateRole(id, data) {
    const res = await this.api.put(`/roles/${id}`, data);
    return res.data;
  }

  async deleteRole(id) {
    const res = await this.api.delete(`/roles/${id}`);
    return res.data;
  }

  async assignRoleToUser(userId, roleId) {
    const res = await this.api.patch(`/users/${userId}/role`, {
      role_id: roleId,
    });
    return res.data;
  }
}

export default new RoleService();
