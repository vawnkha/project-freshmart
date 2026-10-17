const express = require("express");
const router = express.Router();
const auth = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  resetPasswordBodySchema,
  resetPasswordParamsSchema,
} = require("../validators/auth.validator");
const { authLimiter } = require("../middlewares/rate-limit.middleware");

router.post(
  "/login",
  authLimiter,
  validate({ body: loginBodySchema }),
  auth.login,
);
router.post(
  "/change-password",
  authMiddleware,
  validate({ body: changePasswordBodySchema }),
  auth.changePassword,
);
router.post(
  "/forgot-password",
  authLimiter,
  validate({ body: forgotPasswordBodySchema }),
  auth.forgotPassword,
);
router.post(
  "/reset-password/:userId/:token",
  authLimiter,
  validate({
    params: resetPasswordParamsSchema,
    body: resetPasswordBodySchema,
  }),
  auth.resetPassword,
);

module.exports = router;
