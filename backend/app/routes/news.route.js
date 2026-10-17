const express = require("express");
const controller = require("../controllers/news.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  newsIdParamSchema,
  newsQuerySchema,
  createNewsSchema,
  updateNewsSchema,
} = require("../validators/news.validator");

const router = express.Router();
const canManageNews = authMiddleware.authorizePermissions("news:manage");

router.get("/public", validate({ query: newsQuerySchema }), controller.findPublic);
router.get("/public/:slug", controller.findPublicBySlug);

router.use(authMiddleware, canManageNews);

router.route("/")
  .get(validate({ query: newsQuerySchema }), controller.findAll)
  .post(validate({ body: createNewsSchema }), controller.create);
router
  .route("/:id")
  .get(validate({ params: newsIdParamSchema }), controller.findOne)
  .put(validate({ params: newsIdParamSchema, body: updateNewsSchema }), controller.update)
  .delete(validate({ params: newsIdParamSchema }), controller.remove);

module.exports = router;
