const { z } = require("zod");
const expiryChoiceSchema = z.object({ group: z.enum(['long', 'other', 'promotion']), discountId: z.string().regex(/^[a-f\d]{24}$/i).optional(), minRemainingDays: z.number().int().min(1).max(3650).optional() }).strict();
const choiceFields = { expiryChoice: expiryChoiceSchema.optional(), quoteFingerprint: z.string().regex(/^[a-f\d]{64}$/).optional() };
const {
  objectIdSchema,
} = require("./common.validator");

const cartUserParamSchema = z.object({
  userId: objectIdSchema,
});

const cartItemParamSchema = z.object({
  userId: objectIdSchema,
  productId: objectIdSchema,
});

const integerPositiveQuantitySchema = z.preprocess(
  (value) => Number(value),
  z
    .number({ message: "quantity phai la so" })
    .int("quantity phai la so nguyen")
    .positive("quantity phai lon hon 0"),
);

const integerNonNegativeQuantitySchema = z.preprocess(
  (value) => Number(value),
  z
    .number({ message: "quantity phai la so" })
    .int("quantity phai la so nguyen")
    .min(0, "quantity phai lon hon hoac bang 0"),
);

const addCartItemSchema = z
  .object({
    product_id: objectIdSchema.optional(),
    productId: objectIdSchema.optional(),
    quantity: integerPositiveQuantitySchema.optional().default(1),
    ...choiceFields,
  })
  .superRefine((value, ctx) => {
    if (!value.product_id && !value.productId) {
      ctx.addIssue({
        code: "custom",
        path: ["product_id"],
        message: "product_id la bat buoc",
      });
    }
  })
  .transform((value) => ({
    ...value,
    product_id: value.product_id || value.productId,
  }));

const updateCartItemSchema = z.object({
  ...choiceFields,
  quantity: integerNonNegativeQuantitySchema,
});

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateAddItem(req) {
  return hasValue(req.body?.product_id) || hasValue(req.body?.productId)
    ? ok()
    : bad("product_id la bat buoc");
}

function validateUpdateItem(req) {
  return hasValue(req.body?.quantity) ? ok() : bad("quantity la bat buoc");
}

module.exports = {
  expiryChoiceSchema,
  addCartItemSchema,
  cartItemParamSchema,
  cartUserParamSchema,
  updateCartItemSchema,
  validateAddItem,
  validateUpdateItem,
};
