const express = require("express");
const makeController = require("../controllers/catalog-entity.controller");
const BrandRepository = require("../repositories/brand.repository");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createCatalogSchema,
  updateCatalogSchema,
} = require("../validators/catalog.validator");

const router = express.Router();
const brands = makeController(BrandRepository, "thuong hieu");
const canManageCatalog = authMiddleware.authorizePermissions("brand:manage");

router.use(authMiddleware, canManageCatalog);

router.route("/").get(brands.findAll).post(validate({ body: createCatalogSchema }), brands.create);
router
  .route("/:id")
  .get(validate({ params: idParamSchema }), brands.findOne)
  .put(validate({ params: idParamSchema, body: updateCatalogSchema }), brands.update)
  .delete(validate({ params: idParamSchema }), brands.remove);

module.exports = router;
