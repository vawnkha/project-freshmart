const ApiError = require("../api-error");
const ShippingMethodRepository = require("../repositories/shipping-method.repository");
const validator = require("../validators/shipping-method.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function clean(data) {
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined || data[key] === "") delete data[key];
  });
  return data;
}

class ShippingMethodService {
  constructor(client) {
    this.repository = new ShippingMethodRepository(client);
  }

  extractData(payload = {}, includeCreatedAt = false) {
    const now = new Date();
    return clean({
      name: hasValue(payload.name) ? String(payload.name).trim() : undefined,
      code: hasValue(payload.code) ? String(payload.code).trim() : undefined,
      description:
        payload.description !== undefined
          ? String(payload.description || "").trim()
          : undefined,
      fee: payload.fee !== undefined ? Number(payload.fee || 0) : undefined,
      estimatedDays:
        payload.estimatedDays !== undefined
          ? Number(payload.estimatedDays || 0)
          : undefined,
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
    if (query.status) filter.status = String(query.status);

    if (query.keyword) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { code: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
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
    const message = validator.validateCreate(payload);
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
    return this.repository.updateById(id, {
      status: "inactive",
      updatedAt: new Date(),
    });
  }
}

module.exports = ShippingMethodService;
