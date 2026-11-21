const express = require("express");
const router = express.Router();
router.use((req, res, next) => { const send = res.send.bind(res); res.send = data => send(require('../utils/customer-order.util')(data)); next(); });
const payment = require("../controllers/payments.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  paypalCaptureOrderSchema,
  paypalCreateOrderSchema,
} = require("../validators/payment.validator");

const canCreatePayment = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.body.user_id,
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
  authMiddleware.authorizeOwnerOrPermissions((req) => req.body.user_id ?? req.user.id),
  payment.captureOrder,
);

module.exports = router;
