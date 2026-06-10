const express = require("express");
const purchaseOrders = require("../controllers/purchase-orders.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createPurchaseOrderSchema,
  purchaseOrderQuerySchema,
  updatePurchaseOrderSchema,
} = require("../validators/purchase-order.validator");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("purchase-order:manage");

router.use(authMiddleware, canManageInventory);

router
  .route("/")
  .get(validate({ query: purchaseOrderQuerySchema }), purchaseOrders.findAll)
  .post(validate({ body: createPurchaseOrderSchema }), purchaseOrders.create);

router.post(
  "/:id/confirm-import",
  validate({ params: idParamSchema }),
  purchaseOrders.confirmImport,
);
router.patch("/:id/cancel", validate({ params: idParamSchema }), purchaseOrders.cancel);

router
  .route("/:id")
  .get(validate({ params: idParamSchema }), purchaseOrders.findOne)
  .put(
    validate({ params: idParamSchema, body: updatePurchaseOrderSchema }),
    purchaseOrders.update,
  );

module.exports = router;
