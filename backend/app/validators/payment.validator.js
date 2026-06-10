const { z } = require("zod");
const {
  nonNegativeNumberSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalString,
} = require("./common.validator");

const paymentMethodSchema = z.enum(["cod", "paypal", "cash"], {
  message: "payment_method khong hop le",
});

function normalizeCheckoutAliases(value) {
  return {
    ...value,
    user_id: value.user_id || value.userId,
    address_id: value.address_id || value.addressId,
    payment_method: value.payment_method || value.paymentMethod,
  };
}

const paypalCreateOrderSchema = z
  .object({
    user_id: objectIdSchema.optional(),
    userId: objectIdSchema.optional(),
    address_id: objectIdSchema.optional(),
    addressId: objectIdSchema.optional(),
    payment_method: paymentMethodSchema.optional(),
    paymentMethod: paymentMethodSchema.optional(),
    shippingMethodId: optionalObjectIdSchema,
    discountCode: optionalString,
    amount: nonNegativeNumberSchema.optional(),
  })
  .passthrough()
  .transform(normalizeCheckoutAliases)
  .superRefine((value, ctx) => {
    if (!value.user_id) {
      ctx.addIssue({
        code: "custom",
        path: ["user_id"],
        message: "user_id la bat buoc",
      });
    }

    if (!value.address_id) {
      ctx.addIssue({
        code: "custom",
        path: ["address_id"],
        message: "address_id la bat buoc",
      });
    }
  });

const paypalCaptureOrderSchema = paypalCreateOrderSchema
  .and(
    z.object({
      paypalOrderId: optionalString,
      orderID: optionalString,
    }).passthrough(),
  )
  .transform((value) => ({
    ...value,
    paypalOrderId: value.paypalOrderId || value.orderID,
  }))
  .superRefine((value, ctx) => {
    if (!value.paypalOrderId) {
      ctx.addIssue({
        code: "custom",
        path: ["paypalOrderId"],
        message: "paypalOrderId la bat buoc",
      });
    }
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

function validateCreateOrder(req) {
  const body = req.body || {};
  if (!hasValue(body.user_id) || !hasValue(body.address_id)) {
    return bad("user_id va address_id la bat buoc");
  }
  return ok();
}

function validateCaptureOrder(req) {
  const body = req.body || {};
  if (
    !hasValue(body.paypalOrderId) ||
    !hasValue(body.user_id) ||
    !hasValue(body.address_id)
  ) {
    return bad("paypalOrderId, user_id, address_id la bat buoc");
  }
  return ok();
}

module.exports = {
  paypalCaptureOrderSchema,
  paypalCreateOrderSchema,
  validateCreateOrder,
  validateCaptureOrder,
};
