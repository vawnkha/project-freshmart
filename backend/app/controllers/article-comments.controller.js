const MongoDB = require("../utils/mongodb.util");
const ArticleCommentService = require("../services/article-comment.service");

const service = () => new ArticleCommentService(MongoDB.client);
exports.list = async (req, res, next) => {
  try { res.send(await service().list(req.params.articleId, req.query)); }
  catch (error) { next(error); }
};
exports.listAdmin = async (req, res, next) => {
  try { res.send(await service().listAdmin(req.query)); }
  catch (error) { next(error); }
};
exports.create = async (req, res, next) => {
  try { res.status(201).send({ message: "Đã gửi bình luận.", data: await service().create(req.params.articleId, req.body, req.user) }); }
  catch (error) { next(error); }
};
exports.update = async (req, res, next) => {
  try { res.send({ message: "Đã cập nhật bình luận.", data: await service().update(req.params.commentId, req.body, req.user) }); }
  catch (error) { next(error); }
};
exports.remove = async (req, res, next) => {
  try { res.send({ message: "Đã xóa bình luận.", data: await service().remove(req.params.commentId, req.user) }); }
  catch (error) { next(error); }
};
