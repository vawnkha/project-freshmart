const express = require("express");
const router = express.Router();
const products = require("../controllers/products.controller");
const uploadProductImage = require("../middlewares/product-upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

const canManageProducts = authMiddleware.authorizePermissions("product:manage");

router.get("/", products.findAll);
router.get("/search", products.search);
router.get("/category/:categoryId", products.findByCategory);
router.get("/:id", products.findOne);
router.post(
  "/",
  authMiddleware,
  canManageProducts,
  uploadProductImage.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "images", maxCount: 4 },
  ]),
  products.create,
);
router.put(
  "/:id",
  authMiddleware,
  canManageProducts,
  uploadProductImage.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "images", maxCount: 4 },
  ]),
  products.update,
);
router.delete("/:id", authMiddleware, canManageProducts, products.delete);

module.exports = router;
