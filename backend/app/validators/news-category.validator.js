const { z } = require("zod");
const {
  nonEmptyString,
  optionalString,
  slugSchema,
  statusEnum,
} = require("./common.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validatePayload(payload = {}, options = {}) {
  if (options.requireRequiredFields) {
    if (!hasValue(payload.name)) return "name la bat buoc";
    if (!hasValue(payload.slug)) return "slug la bat buoc";
  }

  if (payload.status && !["active", "inactive"].includes(String(payload.status))) {
    return "status khong hop le";
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
  createNewsCategorySchema: z.object({
    name: nonEmptyString,
    slug: slugSchema,
    description: optionalString,
    status: statusEnum.optional(),
  }),
  updateNewsCategorySchema: z
    .object({
      name: nonEmptyString.optional(),
      slug: slugSchema.optional(),
      description: optionalString,
      status: statusEnum.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Du lieu cap nhat khong duoc de trong",
    }),
  validateCreate,
  validateUpdate,
};
