const express = require("express");
const router = express.Router();
const user = require("../controllers/user.controller");
const uploadUerAvatar = require("../middlewares/user-upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

const canReadUser = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.params.id,
  "user:read",
);
const canUpdateUser = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.params.id,
  "user:update",
);

router.get("/activate/:id", user.activate);
router.get(
  "/",
  authMiddleware,
  authMiddleware.authorizePermissions("user:read"),
  user.findAll,
);
router.get("/me", authMiddleware, user.getProfile);
router.get("/:id", authMiddleware, canReadUser, user.findOne);
router.post("/", user.create);
router.put(
  "/:id/avatar",
  authMiddleware,
  canUpdateUser,
  uploadUerAvatar.single("avatar"),
  user.updateAvatar,
);
router.put("/:id", authMiddleware, canUpdateUser, user.update);
router.delete(
  "/:id",
  authMiddleware,
  authMiddleware.authorizePermissions("user:delete"),
  user.delete,
);
module.exports = router;
