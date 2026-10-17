const { z } = require("zod");
const {
  idParamSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalString,
} = require("./common.validator");
const PAYMENT_METHODS = require("../constants/payment-methods");

const paymentMethodSchema = z.literal(PAYMENT_METHODS.COD, {
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
    user_id: value.user_id ?? value.userId,
    address_id: value.address_id ?? value.addressId,
    payment_method: value.payment_method ?? value.paymentMethod,
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
    if (!value.payment_method) {
      ctx.addIssue({
        code: "custom",
        path: ["payment_method"],
        message: "payment_method la bat buoc",
      });
    }
    if (value.address_id && value.addressId && value.address_id !== value.addressId) {
      ctx.addIssue({
        code: "custom",
        path: ["address_id"],
        message: "address_id va addressId khong khop",
      });
    }
    if (value.payment_method && value.paymentMethod && value.payment_method !== value.paymentMethod) {
      ctx.addIssue({
        code: "custom",
        path: ["payment_method"],
        message: "payment_method va paymentMethod khong khop",
      });
    }
  });

const orderUserQuerySchema = z.object({
  userId: objectIdSchema,
});

const updateOrderStatusSchema = z
  .object({
    status: orderStatusSchema,
    note: optionalString,
  })
  .transform((value) => ({
    ...value,
    status:
      value.status === "cancelled"
        ? "canceled"
        : value.status === "delivered"
          ? "completed"
          : value.status === "confirmed"
            ? "processing"
            : value.status,
  }));

const cancelOrderSchema = z
  .object({
    reason: optionalString,
    note: optionalString,
  })
  .passthrough();

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
  if (!hasValue(body.user_id) || !hasValue(body.address_id) || !hasValue(body.payment_method)) {
    return bad("user_id, address_id va payment_method la bat buoc");
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
