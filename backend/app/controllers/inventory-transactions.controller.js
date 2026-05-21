const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const InventoryTransactionService = require("../services/inventory-transaction.service");

function getService() {
  return new InventoryTransactionService(MongoDB.client);
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
    if (!document) return next(new ApiError(404, "Giao dich kho khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.findByInventoryItem = async (req, res, next) => {
  try {
    const data = await getService().findByInventoryItemId(
      req.params.inventoryItemId,
    );
    return res.send({ data });
  } catch (error) {
    return next(error);
  }
};
