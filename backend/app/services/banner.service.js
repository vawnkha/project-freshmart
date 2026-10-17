const ResourceDeletionService = require("./resource-deletion.service");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const BannerRepository = require("../repositories/banner.repository");
const validator = require("../validators/banner.validator");
const { sanitizePublicLink } = require("../utils/content-security.util");

const { deleteUnreferencedUpload } = require("../utils/local-upload.util");

function clean(data, options = {}) {
  const keepEmptyStringKeys = new Set(options.keepEmptyStringKeys || []);
  Object.keys(data).forEach((key) => {
    if (
      data[key] === undefined ||
      (data[key] === "" && !keepEmptyStringKeys.has(key))
    ) {
      delete data[key];
    }
  });
  return data;
}

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

class BannerService {
  constructor(client) {
    this.deletion = new ResourceDeletionService(client);
    this.repository = new BannerRepository(client);
  }

  extractData(payload = {}, options = {}) {
    const includeCreatedAt = options.includeCreatedAt !== false;
    const userId = toObjectId(options.userId);
    const now = new Date();
    return clean(
      {
        title:
          payload.title !== undefined
            ? String(payload.title || "").trim()
            : undefined,
        subtitle:
          payload.subtitle !== undefined
            ? String(payload.subtitle || "").trim()
            : undefined,
        description:
          payload.description !== undefined
            ? String(payload.description || "").trim()
            : undefined,
        imageUrl:
          payload.imageUrl !== undefined
            ? String(payload.imageUrl || "").trim()
            : undefined,
        mobileImageUrl:
          payload.mobileImageUrl !== undefined
            ? String(payload.mobileImageUrl || "").trim()
            : undefined,
        link:
          payload.link !== undefined
            ? sanitizePublicLink(payload.link)
            : undefined,
        buttonText:
          payload.buttonText !== undefined
            ? String(payload.buttonText || "").trim()
            : undefined,
        position:
          payload.position !== undefined
            ? String(payload.position).trim()
            : includeCreatedAt
              ? "home_hero"
              : undefined,
        sortOrder:
          payload.sortOrder !== undefined
            ? Number(payload.sortOrder || 0)
            : undefined,
        status:
          payload.status !== undefined
            ? String(payload.status).trim()
            : includeCreatedAt
              ? "active"
              : undefined,
        startDate:
          payload.startDate !== undefined && payload.startDate
            ? new Date(payload.startDate)
            : payload.startDate === ""
              ? null
              : undefined,
        endDate:
          payload.endDate !== undefined && payload.endDate
            ? new Date(payload.endDate)
            : payload.endDate === ""
              ? null
              : undefined,
        createdBy: includeCreatedAt && userId ? userId : undefined,
        updatedBy: userId || undefined,
        createdAt: includeCreatedAt ? now : undefined,
        updatedAt: now,
      },
      {
        keepEmptyStringKeys: [
          "title", "subtitle", "description", "mobileImageUrl", "link", "buttonText",
        ],
      },
    );
  }

  buildFilter(query = {}, options = {}) {
    const filter = {};

    if (options.publicOnly) {
      const now = new Date();
      filter.status = "active";
      filter.$and = [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        },
      ];
    } else if (query.status) {
      filter.status = String(query.status);
    }

    if (query.position) filter.position = String(query.position);

    if (query.keyword && !options.publicOnly) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { subtitle: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { link: { $regex: keyword, $options: "i" } },
      ];
    }

    return filter;
  }

  async find(query = {}, options = {}) {
    const documents = await this.repository.findList(
      this.buildFilter(query, options),
      {
        sort: options.publicOnly
          ? { sortOrder: 1, createdAt: -1 }
          : { createdAt: -1 },
      },
    );
    return documents.map((document) => ({
      ...document,
      link: sanitizePublicLink(document.link),
    }));
  }

  findById(id) {
    return this.repository.findById(id);
  }

  async create(payload = {}, options = {}) {
    const message = validator.validateCreate(payload);
    if (message) throw new ApiError(400, message);

    const data = this.extractData(payload, {
      includeCreatedAt: true,
      userId: options.userId,
    });
    return this.deletion.withReferences(this.deletion.referencesFor("banners", data),
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
    return this.deletion.withReferences(this.deletion.referencesFor("banners", data),
      (session) => this.repository.updateById(id, data, { session }));
  }

  async remove(id) {
    const document = await this.repository.deleteById(id);
    if (!document) return null;

    await Promise.all([...new Set([document.imageUrl, document.mobileImageUrl])].map(
      (url) => deleteUnreferencedUpload(this.repository.client, "banners", url),
    ));
    return document;
  }
}

module.exports = BannerService;
