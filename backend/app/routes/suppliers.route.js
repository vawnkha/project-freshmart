const express = require("express");
const makeController = require("../controllers/catalog-entity.controller");
const SupplierRepository = require("../repositories/supplier.repository");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const suppliers = makeController(SupplierRepository, "nha cung cap");
const canManageCatalog = authMiddleware.authorizePermissions("supplier:manage");

router.use(authMiddleware, canManageCatalog);

router.route("/").get(suppliers.findAll).post(suppliers.create);
router
  .route("/:id")
  .get(suppliers.findOne)
  .put(suppliers.update)
  .delete(suppliers.remove);

module.exports = router;
