const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const {
  DEFAULT_ROLE_CODE,
  DEFAULT_ROLES,
  PERMISSION_CATALOG,
  normalizePermissions,
  normalizeRoleCode,
} = require("../config/permissions");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function uniqueObjectIds(ids = []) {
  const seen = new Set();
  return ids.reduce((result, id) => {
    const objectId = toObjectId(id);
    if (!objectId) return result;

    const key = objectId.toString();
    if (seen.has(key)) return result;

    seen.add(key);
    result.push(objectId);
    return result;
  }, []);
}

class RbacService {
  constructor(client) {
    this.client = client;
    const db = client.db();

    this.Users = db.collection("users");
    this.Roles = db.collection("roles");
    this.Permissions = db.collection("permissions");
    this.RolePermissions = db.collection("role_permissions");
  }

  async ensureIndexes() {
    if (RbacService.indexesReady) return;
    // Index creation is centralized in app/database/indexes.js.
    RbacService.indexesReady = true;
  }

  async ensurePermissions() {
    await this.ensureIndexes();

    if (!PERMISSION_CATALOG.length) return;

    await this.Permissions.bulkWrite(
      PERMISSION_CATALOG.map((permission, index) => ({
        updateOne: {
          filter: { key: permission.key },
          update: {
            $set: {
              label: permission.label,
              group: permission.group,
              description: permission.description,
              sort_order: index,
              updated_at: new Date(),
            },
            $setOnInsert: {
              created_at: new Date(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  async ensureDefaults() {
    if (RbacService.defaultsReady && RbacService.seededClients.has(this.client)) return;
    if (RbacService.seedingClients.has(this.client)) return RbacService.seedingClients.get(this.client);
    const pending = this.seedMissingDefaults();
    RbacService.seedingClients.set(this.client, pending);
    try { await pending; } finally { RbacService.seedingClients.delete(this.client); }
  }

  async seedMissingDefaults() {
    await this.ensurePermissions();

    for (const role of DEFAULT_ROLES) {
      const session = this.client.startSession();
      try { await session.withTransaction(async () => {
      const result = await this.Roles.updateOne(
        { code: role.code },
        {
          $setOnInsert: {
            name: role.name,
            description: role.description,
            is_system: role.is_system,
            status: "active",
            updated_at: new Date(),
            created_at: new Date(),
          },
        },
        { upsert: true, session },
      );
      // Existing assignments and metadata belong to the administrator.
      if (!result.upsertedId) return;
      const permissions = await this.Permissions.find({
        key: { $in: role.permissions },
      }, { session }).toArray();
      if (permissions.length) await this.RolePermissions.insertMany(
        permissions.map((permission) => ({ role_id: result.upsertedId, permission_id: permission._id, created_at: new Date() })),
        { session },
      );
      }); } finally { await session.endSession(); }
    }

    RbacService.defaultsReady = true;
    RbacService.seededClients.add(this.client);
  }

  async replaceRolePermissions(roleId, permissionIds = [], options = {}) {
    const roleObjectId = toObjectId(roleId);
    if (!roleObjectId) {
      throw new ApiError(400, "Role khong hop le");
    }

    const normalizedPermissionIds = uniqueObjectIds(permissionIds);

    const ResourceDeletionService = require("./resource-deletion.service");
    return new ResourceDeletionService(this.client).withReferences(
      [{ collection: "roles", id: roleObjectId }],
      async (session) => {
        await this.RolePermissions.deleteMany({ role_id: roleObjectId }, { session });
        if (!normalizedPermissionIds.length) return;
        await this.RolePermissions.insertMany(
          normalizedPermissionIds.map((permissionId) => ({
            role_id: roleObjectId,
            permission_id: permissionId,
            created_at: new Date(),
          })),
          { ordered: false, session },
        );
      },
      options,
    );
  }

  formatPermission(permission) {
    return {
      _id: String(permission._id),
      key: permission.key,
      label: permission.label,
      group: permission.group,
      description: permission.description,
      sort_order: permission.sort_order || 0,
    };
  }

  formatRole(role) {
    const permissions = (role.permissions || [])
      .slice()
      .sort((a, b) => {
        const groupCompare = String(a.group || "").localeCompare(
          String(b.group || ""),
        );
        if (groupCompare !== 0) return groupCompare;
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      })
      .map((permission) => this.formatPermission(permission));

    return {
      _id: String(role._id),
      code: role.code,
      name: role.name,
      description: role.description || "",
      status: role.status || "active",
      is_system: Boolean(role.is_system),
      permissionIds: permissions.map((permission) => permission._id),
      permissions,
      created_at: role.created_at,
      updated_at: role.updated_at,
    };
  }

  async listPermissions() {
    await this.ensurePermissions();

    const permissions = await this.Permissions.find({})
      .sort({ group: 1, sort_order: 1, key: 1 })
      .toArray();

    return permissions.map((permission) => this.formatPermission(permission));
  }

  async listRoles() {
    await this.ensureDefaults();

    const roles = await this.Roles.aggregate([
      {
        $lookup: {
          from: "role_permissions",
          localField: "_id",
          foreignField: "role_id",
          as: "role_permissions",
        },
      },
      {
        $lookup: {
          from: "permissions",
          localField: "role_permissions.permission_id",
          foreignField: "_id",
          as: "permissions",
        },
      },
      { $sort: { is_system: -1, name: 1 } },
    ]).toArray();

    return roles.map((role) => this.formatRole(role));
  }

  async findRoleById(roleId) {
    const roleObjectId = toObjectId(roleId);
    if (!roleObjectId) return null;

    return this.Roles.findOne({ _id: roleObjectId });
  }

  async findRoleByCode(roleCode) {
    const code = normalizeRoleCode(roleCode);
    return this.Roles.findOne({ code });
  }

  async findActiveRoleByIdOrCode(roleIdOrCode) {
    const objectId = toObjectId(roleIdOrCode);
    const query = objectId
      ? { _id: objectId, status: "active" }
      : { code: normalizeRoleCode(roleIdOrCode), status: "active" };

    return this.Roles.findOne(query);
  }

  async getRolePermissions(roleId, options = {}) {
    const roleObjectId = toObjectId(roleId);
    if (!roleObjectId) return [];

    const rows = await this.RolePermissions.aggregate([
      { $match: { role_id: roleObjectId } },
      {
        $lookup: {
          from: "permissions",
          localField: "permission_id",
          foreignField: "_id",
          as: "permission",
        },
      },
      { $unwind: "$permission" },
      { $replaceRoot: { newRoot: "$permission" } },
      { $sort: { group: 1, sort_order: 1, key: 1 } },
    ], options).toArray();

    return rows;
  }

  async resolveRoleForUser(user = {}) {
    await this.ensureDefaults();

    let role = null;

    if (user.role_id) {
      role = await this.findRoleById(user.role_id);
    }

    if (role?.status === "inactive") {
      role = null;
    }

    if (!role && user.role) {
      role = await this.Roles.findOne({
        code: normalizeRoleCode(user.role),
        status: "active",
      });
    }

    if (!role) {
      role = await this.Roles.findOne({
        code: DEFAULT_ROLE_CODE,
        status: "active",
      });
    }

    return role;
  }

  async getAuthContextForUser(user = {}) {
    const role = await this.resolveRoleForUser(user);
    const rolePermissions = role ? await this.getRolePermissions(role._id) : [];
    const permissions = normalizePermissions(
      rolePermissions.map((permission) => permission.key),
    );

    return {
      id: String(user._id),
      role_id: role ? String(role._id) : null,
      role: role ? role.code : DEFAULT_ROLE_CODE,
      roleName: role ? role.name : "User",
      permissions,
      email: user.email,
      name: user.name,
      status: user.status,
    };
  }

  async getAuthContextForUserId(userId) {
    const objectId = toObjectId(userId);
    if (!objectId) return null;

    const user = await this.Users.findOne({ _id: objectId });
    if (!user) return null;

    return this.getAuthContextForUser(user);
  }

  validateRolePayload(payload = {}, options = {}) {
    const role = {};

    if (!options.partial || payload.name !== undefined) {
      role.name = String(payload.name || "").trim();
      if (!role.name) {
        throw new ApiError(400, "Ten role la bat buoc");
      }
    }

    if (!options.partial || payload.code !== undefined) {
      role.code = normalizeRoleCode(payload.code);
      if (!/^[a-z][a-z0-9_:-]{1,49}$/.test(role.code)) {
        throw new ApiError(
          400,
          "Ma role chi duoc gom chu thuong, so, dau _, :, - va bat dau bang chu",
        );
      }
    }

    if (payload.description !== undefined) {
      role.description = String(payload.description || "").trim();
    }

    if (payload.status !== undefined) {
      const status = String(payload.status || "").trim().toLowerCase();
      if (!["active", "inactive"].includes(status)) {
        throw new ApiError(400, "Trang thai role khong hop le");
      }
      role.status = status;
    }

    return role;
  }

  async resolvePermissionIds(permissionIds = [], actor = null, options = {}) {
    if (!Array.isArray(permissionIds)) {
      throw new ApiError(400, "Danh sach permission khong hop le");
    }

    const ids = uniqueObjectIds(permissionIds);

    if (ids.length !== new Set(permissionIds.map(String)).size) {
      throw new ApiError(400, "Permission khong hop le");
    }

    if (!ids.length) return [];

    const permissions = await this.Permissions.find({
      _id: { $in: ids },
    }, options).toArray();

    if (permissions.length !== ids.length) {
      throw new ApiError(400, "Mot hoac nhieu permission khong ton tai");
    }

    if (actor && !normalizePermissions(actor.permissions).includes("*")) {
      const actorPermissions = new Set(normalizePermissions(actor.permissions));
      const forbidden = permissions.filter(
        (permission) => !actorPermissions.has(permission.key),
      );

      if (forbidden.length) {
        throw new ApiError(
          403,
          "Ban khong the gan permission ma minh khong so huu",
        );
      }
    }

    return permissions.map((permission) => permission._id);
  }

  async getActorUnownedRolePermissionIds(roleId, actor = null, options = {}) {
    if (!actor) return [];

    const actorPermissions = new Set(normalizePermissions(actor.permissions));
    if (actorPermissions.has("*")) return [];

    const rolePermissions = await this.getRolePermissions(roleId, options);
    return rolePermissions
      .filter((permission) => !actorPermissions.has(permission.key))
      .map((permission) => permission._id);
  }

  async createRole(payload = {}, actor = null) {
    await this.ensureDefaults();

    const role = this.validateRolePayload(payload);
    const existed = await this.Roles.findOne({ code: role.code });

    if (existed) {
      throw new ApiError(400, "Ma role da ton tai");
    }

    const permissionIds = await this.resolvePermissionIds(
      payload.permissionIds || [],
      actor,
    );

    const roleId = new ObjectId();
    const session = this.client.startSession();
    try {
      await session.withTransaction(async () => {
        await this.Roles.insertOne({
          _id: roleId, ...role, is_system: false,
          status: role.status || "active", created_at: new Date(), updated_at: new Date(),
        }, { session });
        await this.replaceRolePermissions(roleId, permissionIds, { session });
      });
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.code)
        throw new ApiError(400, "Ma role da ton tai", "DUPLICATE_ROLE_CODE");
      throw error;
    } finally { await session.endSession(); }
    return this.getRoleWithPermissions(roleId);
  }

  async getRoleWithPermissions(roleId) {
    await this.ensureDefaults();

    const roleObjectId = toObjectId(roleId);
    if (!roleObjectId) return null;

    const roles = await this.Roles.aggregate([
      { $match: { _id: roleObjectId } },
      {
        $lookup: {
          from: "role_permissions",
          localField: "_id",
          foreignField: "role_id",
          as: "role_permissions",
        },
      },
      {
        $lookup: {
          from: "permissions",
          localField: "role_permissions.permission_id",
          foreignField: "_id",
          as: "permissions",
        },
      },
    ]).toArray();

    return roles[0] ? this.formatRole(roles[0]) : null;
  }

  async updateRole(roleId, payload = {}, actor = null) {
    await this.ensureDefaults();

    const roleObjectId = toObjectId(roleId);
    if (!roleObjectId) {
      throw new ApiError(400, "Role khong hop le");
    }

    const update = this.validateRolePayload(payload, { partial: true });
    const ResourceDeletionService = require("./resource-deletion.service");
    try {
      await new ResourceDeletionService(this.client).withReferences(
        [{ collection: "roles", id: roleObjectId }], async (session) => {
          const existed = await this.Roles.findOne({ _id: roleObjectId }, { session });
          if (!existed) throw new ApiError(404, "Role khong ton tai");
          if (existed.code === "admin" && payload.permissionIds !== undefined)
            throw new ApiError(400, "Khong the thay doi permission cua role Admin");
          if (update.code && existed.is_system && update.code !== existed.code)
            throw new ApiError(400, "Khong the doi ma cua role he thong");
          if (update.code && update.code !== existed.code &&
              await this.Roles.findOne({ code: update.code }, { session }))
            throw new ApiError(400, "Ma role da ton tai");

          if (payload.permissionIds !== undefined) {
            const permissionIds = await this.resolvePermissionIds(payload.permissionIds, actor, { session });
            const preserved = await this.getActorUnownedRolePermissionIds(roleObjectId, actor, { session });
            await this.replaceRolePermissions(roleObjectId, [...preserved, ...permissionIds], { session });
          }
          if (Object.keys(update).length) await this.Roles.updateOne(
            { _id: roleObjectId }, { $set: { ...update, updated_at: new Date() } }, { session });
        },
      );
    } catch (error) {
      if (error.code === "REFERENCE_NOT_FOUND")
        throw new ApiError(404, "Role khong ton tai");
      if (error.code === 11000 && error.keyPattern?.code)
        throw new ApiError(400, "Ma role da ton tai", "DUPLICATE_ROLE_CODE");
      throw error;
    }

    return this.getRoleWithPermissions(roleObjectId);
  }

  async deleteRole(roleId) {
    await this.ensureDefaults();

    const roleObjectId = toObjectId(roleId);
    if (!roleObjectId) {
      throw new ApiError(400, "Role khong hop le");
    }

    const ResourceDeletionService = require("./resource-deletion.service");
    const deleted = await new ResourceDeletionService(this.client).remove("roles", roleObjectId);
    if (!deleted) {
      throw new ApiError(404, "Role khong ton tai");
    }

    return true;
  }

  async canActorAssignRole(actor = {}, role = {}, options = {}) {
    if (!actor || !role) return false;
    if (actor.role === "admin") return true;

    const actorPermissions = new Set(normalizePermissions(actor.permissions));
    const rolePermissions = await this.getRolePermissions(role._id, options);

    return rolePermissions.every((permission) =>
      actorPermissions.has(permission.key),
    );
  }

  async assignRoleToUser(userId, roleIdOrCode, actor = null) {
    await this.ensureDefaults();

    const userObjectId = toObjectId(userId);
    if (!userObjectId) {
      throw new ApiError(400, "Nguoi dung khong hop le");
    }

    const role = await this.findActiveRoleByIdOrCode(roleIdOrCode);
    if (!role) {
      throw new ApiError(404, "Role khong ton tai hoac da bi vo hieu hoa");
    }

    if (actor && !(await this.canActorAssignRole(actor, role))) {
      throw new ApiError(403, "Ban khong the gan role co quyen cao hon minh");
    }

    const ResourceDeletionService = require("./resource-deletion.service");
    return new ResourceDeletionService(this.client).withReferences(
      [{ collection: "roles", id: role._id }, { collection: "users", id: userObjectId }],
      async (session) => {
      const currentRole = await this.Roles.findOne({ _id: role._id, status: "active" }, { session });
      if (!currentRole) throw new ApiError(409, "Role da thay doi hoac bi vo hieu hoa");
      if (actor && !(await this.canActorAssignRole(actor, currentRole, { session })))
        throw new ApiError(403, "Ban khong the gan role co quyen cao hon minh");
    const result = await this.Users.findOneAndUpdate(
      { _id: userObjectId },
      {
        $set: {
          role_id: role._id,
          role: role.code,
          updated_at: new Date(),
        },
        $unset: { permissions: "" },
      },
      { returnDocument: "after", session },
    );

    if (!result) {
      throw new ApiError(404, "Nguoi dung khong ton tai");
    }

    return result;
      },
    );
  }
}

RbacService.indexesReady = false;
RbacService.defaultsReady = false;
RbacService.seededClients = new WeakSet();
RbacService.seedingClients = new WeakMap();

module.exports = RbacService;
