const express = require("express");
const inventoryItems = require("../controllers/inventory-items.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createInventoryItemSchema,
  inventoryItemQuerySchema,
  updateInventoryItemSchema,
} = require("../validators/inventory-item.validator");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("inventory:manage");

router.use(authMiddleware, canManageInventory);

router
  .route("/")
  .get(validate({ query: inventoryItemQuerySchema }), inventoryItems.findAll)
  .post(validate({ body: createInventoryItemSchema }), inventoryItems.create);

router
  .route("/:id")
  .get(validate({ params: idParamSchema }), inventoryItems.findOne)
  .put(
    validate({ params: idParamSchema, body: updateInventoryItemSchema }),
    inventoryItems.update,
  )
  .delete(validate({ params: idParamSchema }), inventoryItems.delete);

module.exports = router;
