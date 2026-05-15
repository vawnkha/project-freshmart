const express = require("express");
const router = express.Router();
const payment = require("../controllers/payments.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const canCreatePayment = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.body.user_id,
  "payment:create:any",
);

router.use(authMiddleware);

router.post("/create-order", canCreatePayment, payment.createOrder);
router.post("/capture-order", canCreatePayment, payment.captureOrder);

module.exports = router;
