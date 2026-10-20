const { z } = require("zod");
const {
  dateStringSchema,
  nonEmptyString,
  nonNegativeNumberSchema,
  objectIdArraySchema,
  objectIdSchema,
  optionalString,
  positiveNumberSchema,
  statusEnum,
} = require("./common.validator");

const SCOPES = ["order", "product", "category", "batch"];
const TYPES = ["percent", "fixed"];
const STATUSES = ["active", "inactive"];
const scopeSchema = z.enum(SCOPES, { message: "scope khong hop le" });
const typeSchema = z.enum(TYPES, { message: "type khong hop le" });

const applicableSchema = z
  .object({
    productIds: objectIdArraySchema.optional().default([]),
    categoryIds: objectIdArraySchema.optional().default([]),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.variantIds !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["variantIds"],
        message: "variantIds khong duoc ho tro",
      });
    }
  });

function checkDiscountValue(value, ctx) {
  if (value.variantIds !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["variantIds"],
      message: "variantIds khong duoc ho tro",
    });
  }

  if (value.type === "percent" && Number(value.value || 0) > 100) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "value percent khong duoc lon hon 100",
    });
  }

  if (
    value.startDate &&
    value.endDate &&
    new Date(value.startDate).getTime() >= new Date(value.endDate).getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate phai lon hon startDate",
    });
  }
}

const discountBaseSchema = z
  .object({
    code: nonEmptyString,
    name: nonEmptyString,
    description: optionalString,
    isPublic: z.boolean().optional().default(false),
    scope: scopeSchema,
    type: typeSchema,
    value: positiveNumberSchema,
    minOrderValue: nonNegativeNumberSchema.optional().default(0),
    maxDiscountAmount: nonNegativeNumberSchema.optional().default(0),
    quantity: nonNegativeNumberSchema.optional().default(0),
    usedCount: nonNegativeNumberSchema.optional(),
    applicable: applicableSchema.optional(),
    productIds: objectIdArraySchema.optional(),
    categoryIds: objectIdArraySchema.optional(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    status: statusEnum.optional(),
  })
  .passthrough()
  .superRefine(checkDiscountValue);

const discountUpdateSchema = z
  .object({
    code: nonEmptyString.optional(),
    name: nonEmptyString.optional(),
    description: optionalString,
    isPublic: z.boolean().optional(),
    scope: scopeSchema.optional(),
    type: typeSchema.optional(),
    value: positiveNumberSchema.optional(),
    minOrderValue: nonNegativeNumberSchema.optional(),
    maxDiscountAmount: nonNegativeNumberSchema.optional(),
    quantity: nonNegativeNumberSchema.optional(),
    usedCount: nonNegativeNumberSchema.optional(),
    applicable: applicableSchema.optional(),
    productIds: objectIdArraySchema.optional(),
    categoryIds: objectIdArraySchema.optional(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    status: statusEnum.optional(),
  })
  .passthrough()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Du lieu cap nhat khong duoc de trong",
  })
  .superRefine(checkDiscountValue);

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isNonNegativeNumber(value) {
  if (!hasValue(value)) return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function validateCommon(payload = {}, options = {}) {
  if (payload.isPublic !== undefined && typeof payload.isPublic !== "boolean") {
    return "isPublic phai la boolean";
  }
  if (options.requireCode && !hasValue(payload.code)) return "code la bat buoc";
  if (options.requireName && !hasValue(payload.name)) return "name la bat buoc";
  if (options.requireScope && !hasValue(payload.scope)) return "scope la bat buoc";
  if (options.requireType && !hasValue(payload.type)) return "type la bat buoc";
  if (options.requireValue && !hasValue(payload.value)) return "value la bat buoc";

  if (hasValue(payload.scope) && !SCOPES.includes(String(payload.scope))) {
    return "scope khong hop le";
  }

  if (hasValue(payload.type) && !TYPES.includes(String(payload.type))) {
    return "type khong hop le";
  }

  if (hasValue(payload.status) && !STATUSES.includes(String(payload.status))) {
    return "status khong hop le";
  }

  for (const field of [
    "value",
    "minOrderValue",
    "maxDiscountAmount",
    "quantity",
    "usedCount",
  ]) {
    if (!isNonNegativeNumber(payload[field])) {
      return `${field} phai la so khong am`;
    }
  }

  if (String(payload.type || "") === "percent" && Number(payload.value || 0) > 100) {
    return "value percent khong duoc lon hon 100";
  }

  return null;
}

function validateCreate(payload = {}) {
  return validateCommon(payload, {
    requireCode: true,
    requireName: true,
    requireScope: true,
    requireType: true,
    requireValue: true,
  });
}

function validateUpdate(payload = {}) {
  if (!Object.keys(payload || {}).length) {
    return "Du lieu cap nhat khong duoc de trong";
  }

  return validateCommon(payload);
}

function validateValidatePayload(payload = {}) {
  if (!hasValue(payload.code)) return "code la bat buoc";
  return null;
}

module.exports = {
  SCOPES,
  TYPES,
  createDiscountSchema: discountBaseSchema,
  discountIdParamSchema: z.object({
    id: objectIdSchema,
  }),
  discountQuerySchema: z.object({
    status: statusEnum.optional(),
    scope: scopeSchema.optional(),
    type: typeSchema.optional(),
    keyword: optionalString,
  }),
  updateDiscountSchema: discountUpdateSchema,
  validateDiscountSchema: z.object({
    code: nonEmptyString,
    userId: objectIdSchema.optional(),
    subtotal: nonNegativeNumberSchema.optional(),
    orderTotal: nonNegativeNumberSchema.optional(),
    total: nonNegativeNumberSchema.optional(),
    cartItems: z.array(z.any()).optional(),
    items: z.array(z.any()).optional(),
  }).passthrough(),
  validateCreate,
  validateUpdate,
  validateValidatePayload,
};
