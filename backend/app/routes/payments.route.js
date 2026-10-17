const express = require("express");
const router = express.Router();
const payment = require("../controllers/payments.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  paypalCaptureOrderSchema,
  paypalCreateOrderSchema,
} = require("../validators/payment.validator");

const canCreatePayment = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.body.user_id,
  "payment:create:any",
);

router.use(authMiddleware);
router.get("/config", payment.config);

router.post(
  "/create-order",
  validate({ body: paypalCreateOrderSchema }),
  canCreatePayment,
  payment.createOrder,
);
router.post(
  "/capture-order",
  validate({ body: paypalCaptureOrderSchema }),
  payment.captureOrder,
);

module.exports = router;
