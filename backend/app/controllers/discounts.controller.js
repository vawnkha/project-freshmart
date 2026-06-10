const ApiError = require("../api-error");
const DiscountService = require("../services/discount.service");
const MongoDB = require("../utils/mongodb.util");

function getService() {
  return new DiscountService(MongoDB.client);
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
    if (!document) return next(new ApiError(404, "Ma giam gia khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const document = await getService().create(req.body);
    return res.status(201).send({
      message: "Tao ma giam gia thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const document = await getService().update(req.params.id, req.body);
    if (!document) return next(new ApiError(404, "Ma giam gia khong ton tai"));
    return res.send({
      message: "Cap nhat ma giam gia thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const document = await getService().remove(req.params.id);
    if (!document) return next(new ApiError(404, "Ma giam gia khong ton tai"));
    return res.send({
      message: "Da xoa/an ma giam gia thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.validate = async (req, res, next) => {
  try {
    const result = await getService().validateDiscount(req.body || {});
    return res.send(result);
  } catch (error) {
    return next(error);
  }
};
