const ResourceDeletionService = require("./resource-deletion.service");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const NewsRepository = require("../repositories/news.repository");
const validator = require("../validators/news.validator");
const { sanitizeNewsHtml } = require("../utils/content-security.util");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function clean(data, allowEmptyStringFields = new Set()) {
  Object.keys(data).forEach((key) => {
    if (
      data[key] === undefined ||
      (data[key] === "" && !allowEmptyStringFields.has(key))
    ) {
      delete data[key];
    }
  });
  return data;
}

function normalizeSlug(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase();
}

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function normalizeStringList(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.reduce((result, value) => {
    const text = String(value || "").trim();
    if (!text) return result;
    const key = text.toLowerCase();
    if (seen.has(key)) return result;
    seen.add(key);
    result.push(text);
    return result;
  }, []);
}

class NewsService {
  constructor(client) {
    this.deletion = new ResourceDeletionService(client);
    this.repository = new NewsRepository(client);
    this.NewsCategory = client.db().collection("news_categories");
  }

  extractData(payload = {}, options = {}) {
    const includeCreatedAt = options.includeCreatedAt !== false;
    const userId = toObjectId(options.userId);
    const now = new Date();
    const data = clean(
      {
        categoryId:
          payload.categoryId !== undefined
            ? toObjectId(payload.categoryId)
            : undefined,
        title: hasValue(payload.title)
          ? String(payload.title).trim()
          : undefined,
        slug: hasValue(payload.slug) ? normalizeSlug(payload.slug) : undefined,
        summary:
          payload.summary !== undefined
            ? String(payload.summary || "").trim()
            : undefined,
        content:
          payload.content !== undefined
            ? sanitizeNewsHtml(payload.content)
            : undefined,
        thumbnail:
          payload.thumbnail !== undefined
            ? String(payload.thumbnail || "").trim()
            : undefined,
        images:
          payload.images !== undefined
            ? normalizeStringList(payload.images)
            : undefined,
        tags:
          payload.tags !== undefined
            ? normalizeStringList(payload.tags)
            : undefined,
        status:
          payload.status !== undefined
            ? String(payload.status).trim()
            : includeCreatedAt
              ? "draft"
              : undefined,
        publishedAt:
          payload.publishedAt !== undefined && payload.publishedAt
            ? new Date(payload.publishedAt)
            : payload.publishedAt === ""
              ? null
              : undefined,
        seoTitle:
          payload.seoTitle !== undefined
            ? String(payload.seoTitle || "").trim()
            : undefined,
        seoDescription:
          payload.seoDescription !== undefined
            ? String(payload.seoDescription || "").trim()
            : undefined,
        createdBy: includeCreatedAt && userId ? userId : undefined,
        updatedBy: userId || undefined,
        createdAt: includeCreatedAt ? now : undefined,
        updatedAt: now,
      },
      new Set([
        "summary",
        "content",
        "thumbnail",
        "seoTitle",
        "seoDescription",
      ]),
    );

    if (
      data.status === "published" &&
      data.publishedAt === undefined &&
      includeCreatedAt
    ) {
      data.publishedAt = now;
    }

    return data;
  }

  buildFilter(query = {}, options = {}) {
    const filter = {};
    if (options.publicOnly) {
      filter.status = "published";
      filter.$and = [{ $or: [{ publishedAt: null }, { publishedAt: { $lte: new Date() } }] }];
    } else if (query.status) {
      filter.status = String(query.status);
    }

    if (query.categoryId) {
      const categoryId = toObjectId(query.categoryId);
      if (categoryId) filter.categoryId = categoryId;
    }

    if (query.tag) filter.tags = String(query.tag);

    if (query.keyword) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { slug: { $regex: keyword, $options: "i" } },
        { summary: { $regex: keyword, $options: "i" } },
        { tags: { $regex: keyword, $options: "i" } },
      ];
    }

    return filter;
  }

  async ensureCategoryExists(categoryId) {
    if (!categoryId) throw new ApiError(400, "categoryId khong hop le");
    const category = await this.NewsCategory.findOne({ _id: categoryId });
    if (!category) throw new ApiError(400, "Danh muc tin tuc khong ton tai");
  }

  async ensureUniqueSlug(data, currentId = null) {
    if (!data.slug) return;
    const existed = await this.repository.findBySlug(data.slug);
    if (existed && (!currentId || String(existed._id) !== String(currentId))) {
      throw new ApiError(400, "slug da ton tai");
    }
  }

  async find(query = {}, options = {}) {
    const filter = options.publicOnly ? await this.buildPublicFilter(query) : this.buildFilter(query, options);
    const documents = await this.repository.findList(
      filter,
      {
        sort: options.publicOnly
          ? { publishedAt: -1, createdAt: -1 }
          : { createdAt: -1 },
      },
    );
    return documents.map((document) => ({
      ...document,
      content: sanitizeNewsHtml(document.content),
    }));
  }

  async findById(id) {
    const document = await this.repository.findById(id);
    return document
      ? { ...document, content: sanitizeNewsHtml(document.content) }
      : null;
  }

  async findPublicBySlug(slug) {
    const filter = await this.buildPublicFilter();
    const document = await this.repository.findOne({
      ...filter,
      slug: normalizeSlug(slug),
    });
    return document
      ? { ...document, content: sanitizeNewsHtml(document.content) }
      : null;
  }

  async buildPublicFilter(query = {}) {
    const filter = this.buildFilter(query, { publicOnly: true });
    const categories = await this.NewsCategory.find(
      { $or: [{ status: "active" }, { status: { $exists: false } }] },
      { projection: { _id: 1 } },
    ).toArray();
    filter.$and.push({ categoryId: { $in: categories.map((category) => category._id) } });
    return filter;
  }

  async create(payload = {}, options = {}) {
    const message = validator.validateCreate(payload);
    if (message) throw new ApiError(400, message);

    const data = this.extractData(payload, {
      includeCreatedAt: true,
      userId: options.userId,
    });
    await this.ensureCategoryExists(data.categoryId);
    await this.ensureUniqueSlug(data);
    return this.deletion.withReferences(this.deletion.referencesFor("news", data),
      (session) => this.repository.create(data, { session }));
  }

  async update(id, payload = {}, options = {}) {
    const message = validator.validateUpdate(payload);
    if (message) throw new ApiError(400, message);

    const current = await this.repository.findById(id);
    if (!current) return null;

    const data = this.extractData(payload, {
      includeCreatedAt: false,
      userId: options.userId,
    });

    if (data.categoryId !== undefined)
      await this.ensureCategoryExists(data.categoryId);
    await this.ensureUniqueSlug(data, current._id);

    if (
      data.status === "published" &&
      data.publishedAt === undefined &&
      !current.publishedAt
    ) {
      data.publishedAt = new Date();
    }

    return this.deletion.withReferences(this.deletion.referencesFor("news", data),
      (session) => this.repository.updateById(id, data, { session }));
  }

  remove(id, options = {}) {
    return this.deletion.remove("news", id, options);
  }
}

module.exports = NewsService;
