const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");

const systemAdmin = { code: "admin", is_system: true };
const idOf = value => ObjectId.isValid(value) ? new ObjectId(value) : null;
const sameId = (left, right) => left != null && right != null && String(left) === String(right);

async function hasAdminRole(db, account, admin, session) {
  if (!account || !admin) return false;
  if (sameId(account.role_id, admin._id)) return true;
  if (String(account.role || "").trim().toLowerCase() !== "admin") return false;
  const linked = idOf(account.role_id);
  if (!linked) return true;
  // Match RBAC resolution for legacy accounts that have a stale role_id.
  return !(await db.collection("roles").findOne({ _id: linked }, { session }));
}

async function requireActiveAdmin(db, actorId, session, admin) {
  const role = admin || await db.collection("roles").findOne(systemAdmin, { session });
  const actor = await db.collection("users").findOne({ _id: idOf(actorId), status: "active" }, { session });
  if (role?.status !== "active" || !(await hasAdminRole(db, actor, role, session))) {
    throw new ApiError(403, "Chỉ Admin đang hoạt động mới được quản lý tài khoản Admin.", "ADMIN_ACTOR_REQUIRED");
  }
}

async function protectAdminAccount(db, session, actorId, target, change) {
  if (!target) return;
  const roles = db.collection("roles");
  const admin = await roles.findOne(systemAdmin, { session });
  if (!admin) {
    if (change.role?.code === "admin" || String(target.role || "").trim().toLowerCase() === "admin")
      throw new ApiError(409, "Không xác định được vai trò Admin hệ thống.", "ADMIN_ROLE_UNAVAILABLE");
    return;
  }
  const wasAdmin = await hasAdminRole(db, target, admin, session);
  const willBeAdmin = !change.delete && (change.role ? sameId(change.role._id, admin._id) : wasAdmin);
  if (!wasAdmin && !willBeAdmin) return;

  // All privileged mutations write the same role document. Concurrent
  // transactions retry with a fresh snapshot before counting other Admins.
  await roles.updateOne({ _id: admin._id }, { $inc: { adminMutationVersion: 1 } }, { session });
  const self = sameId(actorId, target._id);
  const nextStatus = change.delete ? null : (change.status ?? target.status);
  const removesActiveAdmin = wasAdmin && target.status === "active" && (!willBeAdmin || nextStatus !== "active");
  if (self && wasAdmin && (!willBeAdmin || (change.status && change.status !== "active"))) {
    throw new ApiError(409, "Admin không thể tự hạ quyền, vô hiệu hóa hoặc xóa tài khoản của mình.", "ADMIN_SELF_PROTECTED");
  }
  await requireActiveAdmin(db, actorId, session, admin);
  if (removesActiveAdmin) {
    const candidates = db.collection("users").find({
      _id: { $ne: target._id },
      status: "active",
      $or: [{ role_id: { $in: [admin._id, String(admin._id)] } }, { role: /^\s*admin\s*$/i }],
    }, { session, projection: { role: 1, role_id: 1 } });
    let anotherAdmin = false;
    for await (const candidate of candidates) {
      if (await hasAdminRole(db, candidate, admin, session)) { anotherAdmin = true; break; }
    }
    if (!anotherAdmin) {
      throw new ApiError(409, "Phải giữ ít nhất một tài khoản Admin đang hoạt động.", "LAST_ACTIVE_ADMIN");
    }
  }
  const before = { roleId: wasAdmin ? admin._id : target.role_id ?? null, status: target.status ?? null };
  const after = change.delete ? null : { roleId: change.role?._id ?? before.roleId, status: nextStatus ?? null };
  await db.collection("rbac_admin_audit").insertOne({
    actorId: idOf(actorId), targetId: target._id, action: change.action,
    fields: change.fields || [], before, after, createdAt: new Date(),
  }, { session });
}

module.exports = { requireActiveAdmin, protectAdminAccount };
