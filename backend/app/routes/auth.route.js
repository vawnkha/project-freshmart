const express = require("express");
const router = express.Router();
const auth = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { loginBodySchema } = require("../validators/auth.validator");

router.post("/login", validate({ body: loginBodySchema }), auth.login);
router.post("/change-password", authMiddleware, auth.changePassword);
router.post("/forgot-password", auth.forgotPassword);
router.post("/reset-password/:userId/:token", auth.resetPassword);

module.exports = router;
