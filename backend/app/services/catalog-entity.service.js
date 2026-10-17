const ApiError = require("../api-error");
const validator = require("../validators/catalog.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function clean(data) {
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined || (data[key] === "" && !["code", "description", "email", "phone", "address", "note"].includes(key))) delete data[key];
  });
  return data;
}

class CatalogEntityService {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.options = options;
  }

  extractData(payload = {}, includeCreatedAt = false) {
    const now = new Date();
    return clean({
      code: payload.code !== undefined ? String(payload.code || "").trim() : undefined,
      name: hasValue(payload.name) ? String(payload.name).trim() : undefined,
      description:
        payload.description !== undefined
          ? String(payload.description || "").trim()
          : undefined,
      email:
        payload.email !== undefined ? String(payload.email || "").trim() : undefined,
      phone:
        payload.phone !== undefined ? String(payload.phone || "").trim() : undefined,
      address:
        payload.address !== undefined
          ? String(payload.address || "").trim()
          : undefined,
      note:
        payload.note !== undefined ? String(payload.note || "").trim() : undefined,
      status:
        payload.status !== undefined
          ? String(payload.status || "").trim()
          : includeCreatedAt
            ? "active"
            : undefined,
      createdAt: includeCreatedAt ? now : undefined,
      updatedAt: now,
    });
  }

  buildFilter(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;

    if (query.keyword) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { code: { $regex: keyword, $options: "i" } },
        { name: { $regex: keyword, $options: "i" } },
      ];
    }

    return filter;
  }

  async ensureUniqueCode(data, currentId = null) {
    if (!data.code) return;
    const existed = await this.repository.findByCode(data.code);
    if (existed && (!currentId || String(existed._id) !== String(currentId))) {
      throw new ApiError(400, "code da ton tai");
    }
  }

  find(query = {}) {
    return this.repository.findList(this.buildFilter(query), {
      sort: { createdAt: -1 },
    });
  }

  findById(id) {
    return this.repository.findById(id);
  }

  async create(payload = {}) {
    const message = validator.validateCreate(payload, this.options);
    if (message) throw new ApiError(400, message);

    const data = this.extractData(payload, true);
    await this.ensureUniqueCode(data);
    return this.repository.create(data);
  }

  async update(id, payload = {}) {
    const message = validator.validateUpdate(payload);
    if (message) throw new ApiError(400, message);

    const current = await this.repository.findById(id);
    if (!current) return null;

    const data = this.extractData(payload, false);
    await this.ensureUniqueCode(data, current._id);
    return this.repository.updateById(id, data);
  }

  remove(id) {
    const ResourceDeletionService = require("./resource-deletion.service");
    return new ResourceDeletionService(this.repository.client).remove(this.repository.collectionName, id);
  }
}

module.exports = CatalogEntityService;
