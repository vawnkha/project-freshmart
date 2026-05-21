const express = require("express");
const inventoryTransactions = require("../controllers/inventory-transactions.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("inventory:manage");

router.use(authMiddleware, canManageInventory);

router.get("/", inventoryTransactions.findAll);
router.get(
  "/by-item/:inventoryItemId",
  inventoryTransactions.findByInventoryItem,
);
router.get("/:id", inventoryTransactions.findOne);

module.exports = router;
