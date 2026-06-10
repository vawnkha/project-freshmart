const express = require("express");
const inventoryTransactions = require("../controllers/inventory-transactions.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  inventoryTransactionByItemParamSchema,
  inventoryTransactionIdParamSchema,
  inventoryTransactionQuerySchema,
} = require("../validators/inventory-transaction.validator");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("inventory:manage");

router.use(authMiddleware, canManageInventory);

router.get(
  "/",
  validate({ query: inventoryTransactionQuerySchema }),
  inventoryTransactions.findAll,
);
router.get(
  "/by-item/:inventoryItemId",
  validate({ params: inventoryTransactionByItemParamSchema }),
  inventoryTransactions.findByInventoryItem,
);
router.get(
  "/:id",
  validate({ params: inventoryTransactionIdParamSchema }),
  inventoryTransactions.findOne,
);

module.exports = router;
