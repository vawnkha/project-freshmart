class RbacRepository {
  constructor(client) {
    const db = client.db();
    this.Users = db.collection("users");
    this.Roles = db.collection("roles");
    this.Permissions = db.collection("permissions");
    this.RolePermissions = db.collection("role_permissions");
  }
}

module.exports = RbacRepository;
