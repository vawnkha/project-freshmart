const ApiError = require("../api-error");
const NewsService = require("../services/news.service");
const MongoDB = require("../utils/mongodb.util");

function getService() {
  return new NewsService(MongoDB.client);
}

exports.findAll = async (req, res, next) => {
  try {
    const data = await getService().find(req.query);
    return res.send({ data });
  } catch (error) {
    return next(error);
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const document = await getService().findById(req.params.id);
    if (!document) return next(new ApiError(404, "Bai viet khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.findPublic = async (req, res, next) => {
  try {
    const data = await getService().find(req.query, { publicOnly: true });
    return res.send({ data });
  } catch (error) {
    return next(error);
  }
};

exports.findPublicBySlug = async (req, res, next) => {
  try {
    const document = await getService().findPublicBySlug(req.params.slug);
    if (!document) return next(new ApiError(404, "Bai viet khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const document = await getService().create(req.body, {
      userId: req.user?.id,
    });
    return res.status(201).send({
      message: "Tao bai viet thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const document = await getService().update(req.params.id, req.body, {
      userId: req.user?.id,
    });
    if (!document) return next(new ApiError(404, "Bai viet khong ton tai"));
    return res.send({
      message: "Cap nhat bai viet thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const document = await getService().remove(req.params.id, {
      userId: req.user?.id,
    });
    if (!document) return next(new ApiError(404, "Bai viet khong ton tai"));
    return res.send({
      message: "Da luu tru bai viet thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};
