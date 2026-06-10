const express = require("express");
const controller = require("../controllers/news-categories.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createNewsCategorySchema,
  updateNewsCategorySchema,
} = require("../validators/news-category.validator");

const router = express.Router();
const canManageNews = authMiddleware.authorizePermissions("news:manage");

router.get("/", authMiddleware.optional, controller.findAll);
router.get("/:id", authMiddleware.optional, controller.findOne);
router.post(
  "/",
  authMiddleware,
  canManageNews,
  validate({ body: createNewsCategorySchema }),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  canManageNews,
  validate({ params: idParamSchema, body: updateNewsCategorySchema }),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  canManageNews,
  validate({ params: idParamSchema }),
  controller.remove,
);

module.exports = router;
