const express = require("express");
const purchaseOrders = require("../controllers/purchase-orders.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("purchase-order:manage");

router.use(authMiddleware, canManageInventory);

router
  .route("/")
  .get(purchaseOrders.findAll)
  .post(purchaseOrders.create);

router.post("/:id/confirm-import", purchaseOrders.confirmImport);
router.patch("/:id/cancel", purchaseOrders.cancel);

router
  .route("/:id")
  .get(purchaseOrders.findOne)
  .put(purchaseOrders.update);

module.exports = router;
