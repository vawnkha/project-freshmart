const express = require("express");
const router = express.Router();
const categories = require("../controllers/categories.controller");
const uploadCategoryImage = require("../middlewares/category-upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

const canManageCategories =
  authMiddleware.authorizePermissions("category:manage");

router.get("/", categories.findAll);
router.post(
  "/",
  authMiddleware,
  canManageCategories,
  uploadCategoryImage.single("image"),
  categories.create,
);
router.get("/:slug", categories.findOne);
router.put(
  "/:id",
  authMiddleware,
  canManageCategories,
  uploadCategoryImage.single("image"),
  categories.update,
);
router.delete("/:id", authMiddleware, canManageCategories, categories.delete);

module.exports = router;
