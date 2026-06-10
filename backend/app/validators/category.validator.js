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

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateCategory(req) {
  const body = req.body || {};
  if (!hasValue(body.name) || !hasValue(body.slug)) {
    return bad("name va slug la bat buoc");
  }
  return ok();
}

function validateUpdateCategory(req) {
  return Object.keys(req.body || {}).length
    ? ok()
    : bad("Du lieu de cap nhat khong duoc de trong");
}

module.exports = {
  createCategorySchema: z.object({
    name: nonEmptyString,
    slug: slugSchema,
    description: optionalString,
    status: statusEnum.optional(),
  }),
  updateCategorySchema: z
    .object({
      name: nonEmptyString.optional(),
      slug: slugSchema.optional(),
      description: optionalString,
      status: statusEnum.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Du lieu cap nhat khong duoc de trong",
    }),
  validateCreateCategory,
  validateUpdateCategory,
};
