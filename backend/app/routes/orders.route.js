const express = require("express");
const router = express.Router();
const order = require("../controllers/orders.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  cancelOrderSchema,
  createOrderSchema,
  orderIdParamSchema,
  orderUserQuerySchema,
  updateOrderStatusSchema,
} = require("../validators/order.validator");

router.use(authMiddleware);

router.post(
  "/",
  validate({ body: createOrderSchema }),
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
  validate({ query: orderUserQuerySchema }),
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.query.userId,
    "order:read:any",
  ),
  order.findByUser,
);
router.post(
  "/:id/send-invoice",
  validate({ params: orderIdParamSchema }),
  authMiddleware.authorizePermissions("order:update"),
  order.sendInvoice,
);
router.get("/:id", validate({ params: orderIdParamSchema }), order.findOne);
router.patch(
  "/:id/cancel",
  validate({ params: orderIdParamSchema, body: cancelOrderSchema }),
  order.cancel,
);
router.patch(
  "/:id/complete",
  validate({ params: orderIdParamSchema }),
  order.complete,
);
router.patch(
  "/:id/status",
  validate({ params: orderIdParamSchema, body: updateOrderStatusSchema }),
  authMiddleware.authorizePermissions("order:update"),
  order.updateStatus,
);

module.exports = router;
