const express = require("express");
const makeController = require("../controllers/catalog-entity.controller");
const SupplierRepository = require("../repositories/supplier.repository");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createSupplierSchema,
  updateCatalogSchema,
} = require("../validators/catalog.validator");

const router = express.Router();
const suppliers = makeController(SupplierRepository, "nha cung cap");
const canManageCatalog = authMiddleware.authorizePermissions("supplier:manage");

router.use(authMiddleware, canManageCatalog);

router
  .route("/")
  .get(suppliers.findAll)
  .post(validate({ body: createSupplierSchema }), suppliers.create);
router
  .route("/:id")
  .get(validate({ params: idParamSchema }), suppliers.findOne)
  .put(validate({ params: idParamSchema, body: updateCatalogSchema }), suppliers.update)
  .delete(validate({ params: idParamSchema }), suppliers.remove);

module.exports = router;
