const express = require("express");
const inventorySummaries = require("../controllers/inventory-summaries.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("inventory:manage");

router.use(authMiddleware, canManageInventory);

router.get("/", inventorySummaries.findAll);
router.get("/by-item/:inventoryItemId", inventorySummaries.findByInventoryItem);
router.get("/:id", inventorySummaries.findOne);

module.exports = router;
