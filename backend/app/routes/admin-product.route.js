const express = require("express");
const products = require("../controllers/products.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createProductFromInventoryParamSchema,
  createProductFromInventorySchema,
} = require("../validators/product.validator");

const router = express.Router();
const canManageProducts = authMiddleware.authorizePermissions("product:manage");

router.post(
  "/from-inventory/:inventoryItemId",
  authMiddleware,
  canManageProducts,
  validate({
    params: createProductFromInventoryParamSchema,
    body: createProductFromInventorySchema,
  }),
  products.createFromInventory,
);

module.exports = router;
