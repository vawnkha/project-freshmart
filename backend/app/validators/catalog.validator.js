const { z } = require("zod");
const {
  emailSchema,
  nonEmptyString,
  optionalString,
  statusEnum,
} = require("./common.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateCreate(payload = {}, options = {}) {
  if (!hasValue(payload.name)) return "name la bat buoc";
  if (options.requireCode && !hasValue(payload.code)) return "code la bat buoc";
  return null;
}

function validateUpdate(payload = {}) {
  return Object.keys(payload || {}).length
    ? null
    : "Du lieu cap nhat khong duoc de trong";
}

module.exports = {
  createCatalogSchema: z.object({
    code: optionalString,
    name: nonEmptyString,
    description: optionalString,
    email: z.union([z.literal(""), emailSchema]).optional(),
    phone: optionalString,
    address: optionalString,
    note: optionalString,
    status: statusEnum.optional(),
  }),
  createSupplierSchema: z.object({
    code: optionalString,
    name: nonEmptyString,
    description: optionalString,
    email: z.union([z.literal(""), emailSchema]).optional(),
    phone: optionalString,
    address: optionalString,
    note: optionalString,
    status: statusEnum.optional(),
  }),
  updateCatalogSchema: z
    .object({
      code: optionalString,
      name: nonEmptyString.optional(),
      description: optionalString,
      email: z.union([z.literal(""), emailSchema]).optional(),
      phone: optionalString,
      address: optionalString,
      note: optionalString,
      status: statusEnum.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Du lieu cap nhat khong duoc de trong",
    }),
  validateCreate,
  validateUpdate,
};
