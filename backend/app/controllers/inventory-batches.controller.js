const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const InventoryBatchService = require("../services/inventory-batch.service");

function getService() {
  return new InventoryBatchService(MongoDB.client);
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
    if (!document) return next(new ApiError(404, "Lo hang khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.lock = async (req, res, next) => {
  try {
    const document = await getService().lock(req.params.id);
    return res.send({
      message: "Khoa lo hang thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

exports.unlock = async (req, res, next) => {
  try {
    const document = await getService().unlock(req.params.id);
    return res.send({
      message: "Mo khoa lo hang thanh cong",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};
