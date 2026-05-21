const express = require("express");
const makeController = require("../controllers/catalog-entity.controller");
const ManufacturerRepository = require("../repositories/manufacturer.repository");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const manufacturers = makeController(ManufacturerRepository, "nha san xuat");
const canManageCatalog =
  authMiddleware.authorizePermissions("manufacturer:manage");

router.use(authMiddleware, canManageCatalog);

router.route("/").get(manufacturers.findAll).post(manufacturers.create);
router
  .route("/:id")
  .get(manufacturers.findOne)
  .put(manufacturers.update)
  .delete(manufacturers.remove);

module.exports = router;
