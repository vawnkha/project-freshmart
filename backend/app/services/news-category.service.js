const ApiError = require("../api-error");
const NewsCategoryRepository = require("../repositories/news-category.repository");
const validator = require("../validators/news-category.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function clean(data) {
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined || data[key] === "") delete data[key];
  });
  return data;
}

function normalizeSlug(slug) {
  return String(slug || "").trim().toLowerCase();
}

class NewsCategoryService {
  constructor(client) {
    this.repository = new NewsCategoryRepository(client);
  }

  extractData(payload = {}, includeCreatedAt = false) {
    const now = new Date();
    return clean({
      name: hasValue(payload.name) ? String(payload.name).trim() : undefined,
      slug: hasValue(payload.slug) ? normalizeSlug(payload.slug) : undefined,
      description:
        payload.description !== undefined
          ? String(payload.description || "").trim()
          : undefined,
      status:
        payload.status !== undefined
          ? String(payload.status).trim()
          : includeCreatedAt
            ? "active"
            : undefined,
      createdAt: includeCreatedAt ? now : undefined,
      updatedAt: now,
    });
  }

  buildFilter(query = {}, options = {}) {
    const filter = {};
    if (options.publicOnly) {
      filter.status = "active";
    } else if (query.status) {
      filter.status = String(query.status);
    }

    if (query.keyword) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { slug: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ];
    }

    return filter;
  }

  async ensureUniqueSlug(data, currentId = null) {
    if (!data.slug) return;
    const existed = await this.repository.findBySlug(data.slug);
    if (existed && (!currentId || String(existed._id) !== String(currentId))) {
      throw new ApiError(400, "slug da ton tai");
    }
  }

  find(query = {}, options = {}) {
    return this.repository.findList(this.buildFilter(query, options), {
      sort: { createdAt: -1 },
    });
  }

  async findById(id, options = {}) {
    const document = await this.repository.findById(id);
    if (options.publicOnly && document?.status !== "active") return null;
    return document;
  }

  async create(payload = {}) {
    const message = validator.validateCreate(payload);
    if (message) throw new ApiError(400, message);

    const data = this.extractData(payload, true);
    await this.ensureUniqueSlug(data);
    return this.repository.create(data);
  }

  async update(id, payload = {}) {
    const message = validator.validateUpdate(payload);
    if (message) throw new ApiError(400, message);

    const current = await this.repository.findById(id);
    if (!current) return null;

    const data = this.extractData(payload, false);
    await this.ensureUniqueSlug(data, current._id);
    return this.repository.updateById(id, data);
  }

  remove(id) {
    return this.repository.updateById(id, {
      status: "inactive",
      updatedAt: new Date(),
    });
  }
}

module.exports = NewsCategoryService;
