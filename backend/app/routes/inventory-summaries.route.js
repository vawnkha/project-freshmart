const express = require("express");
const inventorySummaries = require("../controllers/inventory-summaries.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  inventorySummaryByItemParamSchema,
  inventorySummaryIdParamSchema,
} = require("../validators/inventory-summary.validator");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("inventory:manage");

router.use(authMiddleware, canManageInventory);

router.get("/", inventorySummaries.findAll);
router.get(
  "/by-item/:inventoryItemId",
  validate({ params: inventorySummaryByItemParamSchema }),
  inventorySummaries.findByInventoryItem,
);
router.get(
  "/:id",
  validate({ params: inventorySummaryIdParamSchema }),
  inventorySummaries.findOne,
);

module.exports = router;
