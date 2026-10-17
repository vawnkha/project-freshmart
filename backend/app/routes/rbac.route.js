const express = require("express");
const router = express.Router();
const rbac = require("../controllers/rbac.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  roleIdParamSchema,
  roleUserIdParamSchema,
  createRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
} = require("../validators/rbac.validator");

router.use(authMiddleware);

router.get(
  "/permissions",
  authMiddleware.authorizePermissions("role:manage"),
  rbac.listPermissions,
);

router.get(
  "/roles",
  authMiddleware.authorizePermissions("role:manage"),
  rbac.listRoles,
);

router.get(
  "/roles/:id",
  authMiddleware.authorizePermissions("role:manage"),
  validate({ params: roleIdParamSchema }),
  rbac.findRole,
);

router.post(
  "/roles",
  authMiddleware.authorizePermissions("role:manage"),
  validate({ body: createRoleSchema }),
  rbac.createRole,
);

router.put(
  "/roles/:id",
  authMiddleware.authorizePermissions("role:manage"),
  validate({ params: roleIdParamSchema, body: updateRoleSchema }),
  rbac.updateRole,
);

router.delete(
  "/roles/:id",
  authMiddleware.authorizePermissions("role:manage"),
  validate({ params: roleIdParamSchema }),
  rbac.deleteRole,
);

router.patch(
  "/users/:id/role",
  authMiddleware.authorizePermissions("role:manage"),
  validate({ params: roleUserIdParamSchema, body: assignRoleSchema }),
  rbac.assignRoleToUser,
);

module.exports = router;
