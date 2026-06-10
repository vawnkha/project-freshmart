const ApiError = require("../api-error");
const ShippingMethodService = require("../services/shipping-method.service");
const MongoDB = require("../utils/mongodb.util");
const { hasPermission } = require("../config/permissions");

function getService() {
  return new ShippingMethodService(MongoDB.client);
}

exports.findAll = async (req, res, next) => {
  try {
    const canManage = hasPermission(req.user || {}, ["shipping-method:manage"]);
    const query = canManage ? req.query : { ...req.query, status: "active" };
    if (!canManage) delete query.keyword;

    const data = await getService().find(query);
    return res.send({ data });
  } catch (error) {
    return next(error);
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const document = await getService().findById(req.params.id);
    if (!document) return next(new ApiError(404, "Phuong thuc van chuyen khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const document = await getService().create(req.body);
    return res.status(201).send({
      message: "Tao phuong thuc van chuyen thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const document = await getService().update(req.params.id, req.body);
    if (!document) return next(new ApiError(404, "Phuong thuc van chuyen khong ton tai"));
    return res.send({
      message: "Cap nhat phuong thuc van chuyen thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const document = await getService().remove(req.params.id);
    if (!document) return next(new ApiError(404, "Phuong thuc van chuyen khong ton tai"));
    return res.send({
      message: "Da xoa/an phuong thuc van chuyen thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};
