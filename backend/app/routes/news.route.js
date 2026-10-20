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
const comments = require("../controllers/article-comments.controller");
const commentValidator = require("../validators/article-comment.validator");
const { publicWriteLimiter } = require("../middlewares/rate-limit.middleware");

router.get("/public", validate({ query: newsQuerySchema }), controller.findPublic);
router.get("/public/:slug", controller.findPublicBySlug);

router.get("/:articleId/comments", validate({ params: commentValidator.articleCommentParamsSchema, query: commentValidator.commentPageSchema }), comments.list);
router.post("/:articleId/comments", authMiddleware, publicWriteLimiter, validate({ params: commentValidator.articleCommentParamsSchema, body: commentValidator.articleCommentBodySchema }), comments.create);
router.get("/comments", authMiddleware, authMiddleware.authorizePermissions("admin:access", "news:manage"), validate({ query: commentValidator.adminCommentQuerySchema }), comments.listAdmin);
router.patch("/comments/:commentId", authMiddleware, publicWriteLimiter, validate({ params: commentValidator.commentParamsSchema, body: commentValidator.articleCommentBodySchema }), comments.update);
router.delete("/comments/:commentId", authMiddleware, validate({ params: commentValidator.commentParamsSchema }), comments.remove);

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
