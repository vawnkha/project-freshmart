const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const InventorySummaryService = require("../services/inventory-summary.service");

function getService() {
  return new InventorySummaryService(MongoDB.client);
}

exports.findAll = async (_req, res, next) => {
  try {
    const data = await getService().find();
    return res.send({ data });
  } catch (error) {
    return next(error);
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const document = await getService().findById(req.params.id);
    if (!document) return next(new ApiError(404, "Ton kho khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};

exports.findByInventoryItem = async (req, res, next) => {
  try {
    const document = await getService().findByInventoryItemId(
      req.params.inventoryItemId,
    );
    if (!document) return next(new ApiError(404, "Ton kho khong ton tai"));
    return res.send(document);
  } catch (error) {
    return next(error);
  }
};
