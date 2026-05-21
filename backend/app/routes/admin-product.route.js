const express = require("express");
const products = require("../controllers/products.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageProducts = authMiddleware.authorizePermissions("product:manage");

router.post(
  "/from-inventory/:inventoryItemId",
  authMiddleware,
  canManageProducts,
  products.createFromInventory,
);

module.exports = router;
