const { z } = require("zod");
const {
  idParamSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalString,
} = require("./common.validator");

const paymentMethodSchema = z.enum(["cod", "paypal", "cash"], {
  message: "payment_method khong hop le",
});

const orderStatusSchema = z.enum(
  [
    "pending",
    "confirmed",
    "shipping",
    "completed",
    "cancelled",
    "canceled",
    "processing",
    "delivered",
  ],
  { message: "status khong hop le" },
);

function normalizeCheckoutAliases(value) {
  return {
    ...value,
    user_id: value.user_id || value.userId,
    address_id: value.address_id || value.addressId,
    payment_method: value.payment_method || value.paymentMethod,
  };
}

const createOrderSchema = z
  .object({
    user_id: objectIdSchema.optional(),
    userId: objectIdSchema.optional(),
    address_id: objectIdSchema.optional(),
    addressId: objectIdSchema.optional(),
    payment_method: paymentMethodSchema.optional(),
    paymentMethod: paymentMethodSchema.optional(),
    shippingMethodId: optionalObjectIdSchema,
    discountCode: optionalString,
    note: optionalString,
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

const orderUserQuerySchema = z.object({
  userId: objectIdSchema,
});

const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  note: optionalString,
});

const cancelOrderSchema = z.object({
  reason: optionalString,
  note: optionalString,
}).passthrough();

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

function validateUpdateStatus(req) {
  return hasValue(req.body?.status) ? ok() : bad("status la bat buoc");
}

module.exports = {
  cancelOrderSchema,
  createOrderSchema,
  orderIdParamSchema: idParamSchema,
  orderUserQuerySchema,
  updateOrderStatusSchema,
  validateCreateOrder,
  validateUpdateStatus,
};
