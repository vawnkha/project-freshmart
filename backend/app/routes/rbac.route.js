const express = require("express");
const router = express.Router();
const rbac = require("../controllers/rbac.controller");
const authMiddleware = require("../middlewares/auth.middleware");

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
  rbac.findRole,
);

router.post(
  "/roles",
  authMiddleware.authorizePermissions("role:manage"),
  rbac.createRole,
);

router.put(
  "/roles/:id",
  authMiddleware.authorizePermissions("role:manage"),
  rbac.updateRole,
);

router.delete(
  "/roles/:id",
  authMiddleware.authorizePermissions("role:manage"),
  rbac.deleteRole,
);

router.patch(
  "/users/:id/role",
  authMiddleware.authorizePermissions("role:manage"),
  rbac.assignRoleToUser,
);

module.exports = router;
