const express = require("express");
const controller = require("../controllers/news.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageNews = authMiddleware.authorizePermissions("news:manage");

router.get("/public", controller.findPublic);
router.get("/public/:slug", controller.findPublicBySlug);

router.use(authMiddleware, canManageNews);

router.route("/").get(controller.findAll).post(controller.create);
router
  .route("/:id")
  .get(controller.findOne)
  .put(controller.update)
  .delete(controller.remove);

module.exports = router;
