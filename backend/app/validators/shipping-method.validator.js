const { z } = require("zod");
const {
  nonEmptyString,
  optionalNonNegativeNumberSchema,
  optionalString,
  statusEnum,
} = require("./common.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isNonNegativeNumber(value) {
  if (!hasValue(value)) return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function validatePayload(payload = {}, options = {}) {
  if (options.requireName && !hasValue(payload.name)) {
    return "name la bat buoc";
  }

  if (!isNonNegativeNumber(payload.fee)) {
    return "fee phai la so khong am";
  }

  if (!isNonNegativeNumber(payload.estimatedDays)) {
    return "estimatedDays phai la so khong am";
  }

  if (payload.status && !["active", "inactive"].includes(String(payload.status))) {
    return "status khong hop le";
  }

  return null;
}

function validateCreate(payload = {}) {
  return validatePayload(payload, { requireName: true });
}

function validateUpdate(payload = {}) {
  if (!Object.keys(payload || {}).length) {
    return "Du lieu cap nhat khong duoc de trong";
  }

  return validatePayload(payload);
}

module.exports = {
  createShippingMethodSchema: z.object({
    name: nonEmptyString,
    code: optionalString,
    description: optionalString,
    fee: optionalNonNegativeNumberSchema.default(0),
    estimatedDays: optionalNonNegativeNumberSchema,
    status: statusEnum.optional(),
  }),
  updateShippingMethodSchema: z
    .object({
      name: nonEmptyString.optional(),
      code: optionalString,
      description: optionalString,
      fee: optionalNonNegativeNumberSchema,
      estimatedDays: optionalNonNegativeNumberSchema,
      status: statusEnum.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Du lieu cap nhat khong duoc de trong",
    }),
  validateCreate,
  validateUpdate,
};
