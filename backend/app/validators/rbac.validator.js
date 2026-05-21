function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateRole(req) {
  const body = req.body || {};
  if (!hasValue(body.name)) return bad("Ten role la bat buoc");
  if (!hasValue(body.code)) return bad("Ma role la bat buoc");
  if (body.permissionIds !== undefined && !Array.isArray(body.permissionIds)) {
    return bad("Danh sach permission khong hop le");
  }
  return ok();
}

function validateAssignRole(req) {
  const body = req.body || {};
  return hasValue(body.role_id) || hasValue(body.roleId) || hasValue(body.code)
    ? ok()
    : bad("Role la bat buoc");
}

module.exports = {
  validateCreateRole,
  validateAssignRole,
};
