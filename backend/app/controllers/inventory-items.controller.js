const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const InventoryItemService = require("../services/inventory-item.service");

function getService() {
  return new InventoryItemService(MongoDB.client);
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
    if (!document) return next(new ApiError(404, "Hang kho khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const document = await getService().create(req.body);
    return res.status(201).send({
      message: "Tao hang kho thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const document = await getService().update(req.params.id, req.body);
    if (!document) return next(new ApiError(404, "Hang kho khong ton tai"));
    return res.send({
      message: "Cap nhat hang kho thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const document = await getService().delete(req.params.id);
    if (!document) return next(new ApiError(404, "Hang kho khong ton tai"));
    return res.send({ message: "Đã xóa hàng kho thành công" });
  } catch (error) {
    return next(error);
  }
};
