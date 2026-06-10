const { ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
const ApiError = require("../api-error");
const BannerRepository = require("../repositories/banner.repository");
const validator = require("../validators/banner.validator");

const BANNER_UPLOAD_PREFIX = "/uploads/banners/";
const BANNER_UPLOAD_DIR = path.resolve(__dirname, "../../public/uploads/banners");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

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

function resolveBannerUploadPath(url) {
  if (!url || typeof url !== "string") return null;

  const value = url.trim();
  if (!value || /^https?:\/\//i.test(value) || value.startsWith("//")) {
    return null;
  }

  let normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("uploads/banners/")) {
    normalized = `/${normalized}`;
  }

  if (!normalized.startsWith(BANNER_UPLOAD_PREFIX)) return null;

  const rawRelativePath = normalized
    .slice(BANNER_UPLOAD_PREFIX.length)
    .split("?")[0]
    .split("#")[0];
  let relativePath = rawRelativePath;
  try {
    relativePath = decodeURIComponent(rawRelativePath);
  } catch (_) {
    return null;
  }
  if (!relativePath || relativePath.includes("\0")) return null;

  const resolvedPath = path.resolve(BANNER_UPLOAD_DIR, relativePath);
  const relativeFromUploadDir = path.relative(BANNER_UPLOAD_DIR, resolvedPath);

  if (
    relativeFromUploadDir.startsWith("..") ||
    path.isAbsolute(relativeFromUploadDir)
  ) {
    return null;
  }

  return resolvedPath;
}

async function unlinkIfExists(filePath) {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    console.warn("Cannot delete banner image:", filePath, error.message);
    return false;
  }
}

class BannerService {
  constructor(client) {
    this.repository = new BannerRepository(client);
  }

  extractData(payload = {}, options = {}) {
    const includeCreatedAt = options.includeCreatedAt !== false;
    const userId = toObjectId(options.userId);
    const now = new Date();
    return clean({
      title:
        payload.title !== undefined ? String(payload.title || "").trim() : undefined,
      subtitle:
        payload.subtitle !== undefined ? String(payload.subtitle || "").trim() : undefined,
      description:
        payload.description !== undefined
          ? String(payload.description || "").trim()
          : undefined,
      imageUrl:
        payload.imageUrl !== undefined ? String(payload.imageUrl || "").trim() : undefined,
      mobileImageUrl:
        payload.mobileImageUrl !== undefined
          ? String(payload.mobileImageUrl || "").trim()
          : undefined,
      link: payload.link !== undefined ? String(payload.link || "").trim() : undefined,
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
        payload.sortOrder !== undefined ? Number(payload.sortOrder || 0) : undefined,
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
    }, {
      keepEmptyStringKeys: ["title", "subtitle", "description"],
    });
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

  find(query = {}, options = {}) {
    return this.repository.findList(this.buildFilter(query, options), {
      sort: options.publicOnly ? { sortOrder: 1, createdAt: -1 } : { createdAt: -1 },
    });
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
    return this.repository.create(data);
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
    return this.repository.updateById(id, data);
  }

  async remove(id) {
    const document = await this.repository.deleteById(id);
    if (!document) return null;

    const filePaths = new Set(
      [document.imageUrl, document.mobileImageUrl]
        .map(resolveBannerUploadPath)
        .filter(Boolean),
    );

    await Promise.all([...filePaths].map(unlinkIfExists));
    return document;
  }
}

module.exports = BannerService;
