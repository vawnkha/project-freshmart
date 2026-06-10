const express = require("express");
const router = express.Router();
const products = require("../controllers/products.controller");
const uploadProductImage = require("../middlewares/product-upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  productCategoryParamSchema,
  productCreateSchema,
  productIdParamSchema,
  productQuerySchema,
  productUpdateSchema,
} = require("../validators/product.validator");

const canManageProducts = authMiddleware.authorizePermissions("product:manage");

router.get("/", validate({ query: productQuerySchema }), products.findAll);
router.get("/search", validate({ query: productQuerySchema }), products.search);
router.get(
  "/category/:categoryId",
  validate({ params: productCategoryParamSchema, query: productQuerySchema }),
  products.findByCategory,
);
router.get("/:id", validate({ params: productIdParamSchema }), products.findOne);
router.post(
  "/",
  authMiddleware,
  canManageProducts,
  uploadProductImage.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "images", maxCount: 4 },
  ]),
  validate({ body: productCreateSchema }),
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
  validate({ params: productIdParamSchema, body: productUpdateSchema }),
  products.update,
);
router.delete(
  "/:id",
  authMiddleware,
  canManageProducts,
  validate({ params: productIdParamSchema }),
  products.delete,
);

module.exports = router;
