const MongoDB = require("../utils/mongodb.util");
const DashboardService = require("../services/dashboard.service");

exports.overview = async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    return res.json(
      await new DashboardService(MongoDB.client).overview(req.query, req.user),
    );
  } catch (error) {
    return next(error);
  }
};
