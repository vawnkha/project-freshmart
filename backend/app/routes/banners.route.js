const express = require("express");
const controller = require("../controllers/banners.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createBannerSchema,
  updateBannerSchema,
} = require("../validators/banner.validator");

const router = express.Router();
const canManageBanners = authMiddleware.authorizePermissions("banner:manage");

router.get("/public", controller.findPublic);

router.use(authMiddleware, canManageBanners);

router.route("/").get(controller.findAll).post(validate({ body: createBannerSchema }), controller.create);
router
  .route("/:id")
  .get(validate({ params: idParamSchema }), controller.findOne)
  .put(validate({ params: idParamSchema, body: updateBannerSchema }), controller.update)
  .delete(validate({ params: idParamSchema }), controller.remove);

module.exports = router;
