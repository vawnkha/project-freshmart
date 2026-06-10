const express = require("express");
const router = express.Router();
const categories = require("../controllers/categories.controller");
const uploadCategoryImage = require("../middlewares/category-upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createCategorySchema,
  updateCategorySchema,
} = require("../validators/category.validator");

const canManageCategories =
  authMiddleware.authorizePermissions("category:manage");

router.get("/", categories.findAll);
router.post(
  "/",
  authMiddleware,
  canManageCategories,
  uploadCategoryImage.single("image"),
  validate({ body: createCategorySchema }),
  categories.create,
);
router.get("/:slug", categories.findOne);
router.put(
  "/:id",
  authMiddleware,
  canManageCategories,
  validate({ params: idParamSchema }),
  uploadCategoryImage.single("image"),
  validate({ body: updateCategorySchema }),
  categories.update,
);
router.delete(
  "/:id",
  authMiddleware,
  canManageCategories,
  validate({ params: idParamSchema }),
  categories.delete,
);

module.exports = router;
