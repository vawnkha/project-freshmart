const express = require("express");
const inventoryBatches = require("../controllers/inventory-batches.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("inventory:manage");

router.use(authMiddleware, canManageInventory);

router.get("/", inventoryBatches.findAll);
router.patch("/:id/lock", inventoryBatches.lock);
router.patch("/:id/unlock", inventoryBatches.unlock);
router.get("/:id", inventoryBatches.findOne);

module.exports = router;
