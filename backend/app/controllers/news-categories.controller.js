const ApiError = require("../api-error");
const NewsCategoryService = require("../services/news-category.service");
const MongoDB = require("../utils/mongodb.util");
const { hasPermission } = require("../config/permissions");

function getService() {
  return new NewsCategoryService(MongoDB.client);
}

function canManage(req) {
  return hasPermission(req.user || {}, ["news:manage"]);
}

exports.findAll = async (req, res, next) => {
  try {
    const data = await getService().find(req.query, {
      publicOnly: !canManage(req),
    });
    return res.send({ data });
  } catch (error) {
    return next(error);
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const document = await getService().findById(req.params.id, {
      publicOnly: !canManage(req),
    });
    if (!document) return next(new ApiError(404, "Danh muc tin tuc khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const document = await getService().create(req.body);
    return res.status(201).send({
      message: "Tao danh muc tin tuc thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const document = await getService().update(req.params.id, req.body);
    if (!document) return next(new ApiError(404, "Danh muc tin tuc khong ton tai"));
    return res.send({
      message: "Cap nhat danh muc tin tuc thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const document = await getService().remove(req.params.id);
    if (!document) return next(new ApiError(404, "Danh muc tin tuc khong ton tai"));
    return res.send({
      message: "Da an danh muc tin tuc thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};
