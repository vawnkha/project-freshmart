const express = require("express");
const inventoryBatches = require("../controllers/inventory-batches.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  batchQuerySchema,
  inventoryBatchIdParamSchema,
} = require("../validators/inventory-batch.validator");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("inventory:manage");

router.use(authMiddleware, canManageInventory);

router.get("/", validate({ query: batchQuerySchema }), inventoryBatches.findAll);
router.patch(
  "/:id/lock",
  validate({ params: inventoryBatchIdParamSchema }),
  inventoryBatches.lock,
);
router.patch(
  "/:id/unlock",
  validate({ params: inventoryBatchIdParamSchema }),
  inventoryBatches.unlock,
);
router.get(
  "/:id",
  validate({ params: inventoryBatchIdParamSchema }),
  inventoryBatches.findOne,
);

module.exports = router;
