const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const PurchaseOrderService = require("../services/purchase-order.service");

function getService() {
  return new PurchaseOrderService(MongoDB.client);
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
    if (!document) return next(new ApiError(404, "Phieu nhap khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const document = await getService().create(req.body, req.user);
    return res.status(201).send({
      message: "Tao phieu nhap thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const document = await getService().update(req.params.id, req.body, req.user);
    if (!document) return next(new ApiError(404, "Phieu nhap khong ton tai"));
    return res.send({
      message: "Cap nhat phieu nhap thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.confirmImport = async (req, res, next) => {
  try {
    const result = await getService().confirmImport(req.params.id, req.user);
    if (!result) return next(new ApiError(404, "Phieu nhap khong ton tai"));
    return res.send({
      message: "Nhap kho thanh cong",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const document = await getService().cancel(req.params.id);
    if (!document) return next(new ApiError(404, "Phieu nhap khong ton tai"));
    return res.send({
      message: "Huy phieu nhap thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};
