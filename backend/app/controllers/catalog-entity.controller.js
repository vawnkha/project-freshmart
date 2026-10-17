const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const CatalogEntityService = require("../services/catalog-entity.service");

function makeController(Repository, label, options = {}) {
  function getService() {
    return new CatalogEntityService(new Repository(MongoDB.client), options);
  }

  return {
    async findAll(req, res, next) {
      try {
        const data = await getService().find(req.query);
        return res.send({ data });
      } catch (error) {
        return next(error);
      }
    },

    async findOne(req, res, next) {
      try {
        const document = await getService().findById(req.params.id);
        if (!document) return next(new ApiError(404, `${label} khong ton tai`));
        return res.send(document);
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const document = await getService().create(req.body);
        return res.status(201).send({
          message: `Tao ${label} thanh cong`,
          data: document,
        });
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const document = await getService().update(req.params.id, req.body);
        if (!document) return next(new ApiError(404, `${label} khong ton tai`));
        return res.send({
          message: `Cap nhat ${label} thanh cong`,
          data: document,
        });
      } catch (error) {
        return next(error);
      }
    },

    async remove(req, res, next) {
      try {
        const document = await getService().remove(req.params.id);
        if (!document) return next(new ApiError(404, `${label} khong ton tai`));
        return res.send({ message: `Đã xóa ${label} thành công` });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = makeController;
