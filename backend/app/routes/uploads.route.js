const express = require("express");
const uploads = require("../controllers/uploads.controller");
const uploadProductImage = require("../middlewares/product-upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageProducts = authMiddleware.authorizePermissions("product:manage");

router.post(
  "/products",
  authMiddleware,
  canManageProducts,
  uploadProductImage.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "images", maxCount: 4 },
  ]),
  uploads.uploadProductImages,
);

module.exports = router;
