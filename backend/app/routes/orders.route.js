const express = require("express");
const router = express.Router();
const order = require("../controllers/orders.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.use(authMiddleware);

router.post(
  "/",
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.body.user_id,
    "order:manage",
  ),
  order.create,
);
router.get(
  "/all",
  authMiddleware.authorizePermissions("order:read:any"),
  order.findAll,
);
router.get(
  "/",
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.query.userId,
    "order:read:any",
  ),
  order.findByUser,
);
router.post(
  "/:id/send-invoice",
  authMiddleware.authorizePermissions("order:update"),
  order.sendInvoice,
);
router.get("/:id", order.findOne);
router.patch("/:id/cancel", order.cancel);
router.patch("/:id/complete", order.complete);
router.patch(
  "/:id/status",
  authMiddleware.authorizePermissions("order:update"),
  order.updateStatus,
);

module.exports = router;
