const express = require("express");
const products = require("../controllers/products.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createProductFromInventoryParamSchema,
  createProductFromInventorySchema,
  productQuerySchema,
} = require("../validators/product.validator");

const router = express.Router();
const canManageProducts = authMiddleware.authorizePermissions("product:manage");
const canReadProducts = authMiddleware.authorizePermissions(
  "admin:access",
  "product:manage",
);

router.get(
  "/",
  authMiddleware,
  canReadProducts,
  validate({ query: productQuerySchema }),
  products.findAllAdmin,
);

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
