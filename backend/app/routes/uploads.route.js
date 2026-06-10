const express = require("express");
const uploads = require("../controllers/uploads.controller");
const uploadProductImage = require("../middlewares/product-upload.middleware");
const uploadBannerImage = require("../middlewares/banner-upload.middleware");
const uploadNewsImage = require("../middlewares/news-upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageProducts = authMiddleware.authorizePermissions("product:manage");
const canManageBanners = authMiddleware.authorizePermissions("banner:manage");
const canManageNews = authMiddleware.authorizePermissions("news:manage");

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

router.post(
  "/banners",
  authMiddleware,
  canManageBanners,
  uploadBannerImage.single("image"),
  uploads.uploadBannerImage,
);

router.post(
  "/news",
  authMiddleware,
  canManageNews,
  uploadNewsImage.single("image"),
  uploads.uploadNewsImage,
);

module.exports = router;
