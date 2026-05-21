const express = require("express");
const makeController = require("../controllers/catalog-entity.controller");
const BrandRepository = require("../repositories/brand.repository");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const brands = makeController(BrandRepository, "thuong hieu");
const canManageCatalog = authMiddleware.authorizePermissions("brand:manage");

router.use(authMiddleware, canManageCatalog);

router.route("/").get(brands.findAll).post(brands.create);
router.route("/:id").get(brands.findOne).put(brands.update).delete(brands.remove);

module.exports = router;
