const { z } = require("zod");
const { normalizeNewsTags } = require("../utils/news-tags.util");
const {
  idParamSchema,
  nonEmptyString,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalSlugSchema,
  optionalString,
  slugSchema,
} = require("./common.validator");

const statusSchema = z.enum(["draft", "published", "archived"]);
const optionalDateSchema = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "publishedAt khong hop le").optional(),
);
const stringListSchema = z.array(z.string());
const newsTagsSchema = z.union([z.string(), z.array(z.string())]).transform(normalizeNewsTags);

const newsFields = {
  categoryId: objectIdSchema,
  title: nonEmptyString,
  slug: slugSchema,
  summary: optionalString,
  content: optionalString,
  thumbnail: optionalString,
  images: stringListSchema.optional(),
  tags: newsTagsSchema.optional(),
  status: statusSchema.optional(),
  publishedAt: optionalDateSchema,
  seoTitle: optionalString,
  seoDescription: optionalString,
};

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validatePayload(payload = {}, options = {}) {
  if (options.requireRequiredFields) {
    if (!hasValue(payload.categoryId)) return "categoryId la bat buoc";
    if (!hasValue(payload.title)) return "title la bat buoc";
    if (!hasValue(payload.slug)) return "slug la bat buoc";
  }

  if (payload.status && !["draft", "published", "archived"].includes(String(payload.status))) {
    return "status khong hop le";
  }

  if (payload.images !== undefined && !Array.isArray(payload.images)) {
    return "images phai la mang";
  }

  if (payload.tags !== undefined && !newsTagsSchema.safeParse(payload.tags).success) {
    return "Tags phải là chuỗi hoặc mảng các chuỗi";
  }

  return null;
}

function validateCreate(payload = {}) {
  return validatePayload(payload, { requireRequiredFields: true });
}

function validateUpdate(payload = {}) {
  if (!Object.keys(payload || {}).length) {
    return "Du lieu cap nhat khong duoc de trong";
  }

  return validatePayload(payload);
}

module.exports = {
  newsIdParamSchema: idParamSchema,
  newsQuerySchema: z.object({
    status: statusSchema.optional(),
    categoryId: optionalObjectIdSchema,
    tag: optionalString,
    keyword: optionalString,
  }),
  createNewsSchema: z.object(newsFields),
  updateNewsSchema: z.object({
    ...newsFields,
    categoryId: optionalObjectIdSchema,
    title: nonEmptyString.optional(),
    slug: optionalSlugSchema,
    publishedAt: z.union([z.literal(""), optionalDateSchema]),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Du lieu cap nhat khong duoc de trong",
  }),
  validateCreate,
  validateUpdate,
};
