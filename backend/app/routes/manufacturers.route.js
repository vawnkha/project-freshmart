const express = require("express");
const makeController = require("../controllers/catalog-entity.controller");
const ManufacturerRepository = require("../repositories/manufacturer.repository");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createCatalogSchema,
  updateCatalogSchema,
} = require("../validators/catalog.validator");

const router = express.Router();
const manufacturers = makeController(ManufacturerRepository, "nha san xuat");
const canManageCatalog =
  authMiddleware.authorizePermissions("manufacturer:manage");

router.use(authMiddleware, canManageCatalog);

router
  .route("/")
  .get(manufacturers.findAll)
  .post(validate({ body: createCatalogSchema }), manufacturers.create);
router
  .route("/:id")
  .get(validate({ params: idParamSchema }), manufacturers.findOne)
  .put(validate({ params: idParamSchema, body: updateCatalogSchema }), manufacturers.update)
  .delete(validate({ params: idParamSchema }), manufacturers.remove);

module.exports = router;
