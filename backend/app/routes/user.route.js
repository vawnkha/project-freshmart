const express = require("express");
const router = express.Router();
const user = require("../controllers/user.controller");
const uploadUerAvatar = require("../middlewares/user-upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createUserSchema,
  updateUserSchema,
} = require("../validators/user.validator");
const { authLimiter } = require("../middlewares/rate-limit.middleware");

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
router.post(
  "/",
  authLimiter,
  validate({ body: createUserSchema }),
  user.create,
);
router.put(
  "/:id/avatar",
  authMiddleware,
  canUpdateUser,
  validate({ params: idParamSchema }),
  uploadUerAvatar.single("avatar"),
  user.updateAvatar,
);
router.put(
  "/:id",
  authMiddleware,
  canUpdateUser,
  validate({ params: idParamSchema, body: updateUserSchema }),
  user.update,
);
router.delete(
  "/:id",
  authMiddleware,
  authMiddleware.authorizePermissions("user:delete"),
  validate({ params: idParamSchema }),
  user.delete,
);
module.exports = router;
