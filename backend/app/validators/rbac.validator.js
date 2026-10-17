const { z } = require("zod");
const { idParamSchema, nonEmptyString, objectIdSchema, optionalString } = require("./common.validator");

const statusSchema = z.enum(["active", "inactive"]);
const permissionIdsSchema = z.array(objectIdSchema);

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
  roleIdParamSchema: idParamSchema,
  roleUserIdParamSchema: idParamSchema,
  createRoleSchema: z.object({
    name: nonEmptyString,
    code: nonEmptyString,
    description: optionalString,
    status: statusSchema.optional(),
    permissionIds: permissionIdsSchema.optional(),
  }),
  updateRoleSchema: z.object({
    name: nonEmptyString.optional(),
    code: nonEmptyString.optional(),
    description: optionalString,
    status: statusSchema.optional(),
    permissionIds: permissionIdsSchema.optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Du lieu cap nhat khong duoc de trong",
  }),
  assignRoleSchema: z.object({
    role_id: nonEmptyString.optional(),
    roleId: nonEmptyString.optional(),
    code: nonEmptyString.optional(),
  }).refine((value) => Boolean(value.role_id || value.roleId || value.code), {
    message: "Role la bat buoc",
  }),
  validateCreateRole,
  validateAssignRole,
};
