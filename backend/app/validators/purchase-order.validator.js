const { z } = require("zod");
const {
  dateStringSchema,
  nonEmptyString,
  nonNegativeNumberSchema,
  objectIdSchema,
  optionalString,
  positiveNumberSchema,
} = require("./common.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Danh sach hang nhap khong duoc de trong";
  }

  for (const item of items) {
    if (!hasValue(item.inventoryItemId)) return "inventoryItemId la bat buoc";
    if (Number(item.quantity || 0) <= 0) return "quantity phai lon hon 0";
    if (Number(item.importPrice || 0) < 0) return "importPrice khong hop le";
    if (!hasValue(item.batchNumber)) return "batchNumber la bat buoc";
    if (!hasValue(item.expiryDate)) return "expiryDate la bat buoc";
  }

  return null;
}

function validateCreate(payload = {}) {
  return validateItems(payload.items);
}

function validateUpdate(payload = {}) {
  if (!Object.keys(payload || {}).length) {
    return "Du lieu cap nhat khong duoc de trong";
  }

  if (payload.items !== undefined) return validateItems(payload.items);
  return null;
}

module.exports = {
  purchaseOrderQuerySchema: z.object({
    status: z.enum(["draft", "imported", "cancelled"], {
      message: "Trang thai phieu nhap khong hop le",
    }).optional(),
    supplierId: objectIdSchema.optional(),
  }),
  purchaseOrderItemSchema: z
    .object({
      inventoryItemId: objectIdSchema,
      quantity: positiveNumberSchema,
      importPrice: nonNegativeNumberSchema,
      batchNumber: nonEmptyString,
      manufacturingDate: dateStringSchema,
      expiryDate: z
        .string()
        .refine((value) => !!require("../utils/expiry.util").normalizeExpiryDate(value), {
          message: "expiryDate khong hop le",
        }),
      warehouseLocation: optionalString,
    })
    .refine(
      (value) =>
        !value.manufacturingDate ||
        !value.expiryDate ||
        new Date(value.expiryDate).getTime() >
          new Date(value.manufacturingDate).getTime(),
      {
        message: "expiryDate phai lon hon manufacturingDate",
        path: ["expiryDate"],
      },
    ),
  createPurchaseOrderSchema: z.object({
    purchaseCode: optionalString,
    supplierId: objectIdSchema,
    note: optionalString,
    items: z.array(z.lazy(() => module.exports.purchaseOrderItemSchema)).min(1, {
      message: "Danh sach hang nhap khong duoc de trong",
    }),
  }),
  updatePurchaseOrderSchema: z
    .object({
      purchaseCode: optionalString,
      supplierId: objectIdSchema.optional(),
      note: optionalString,
      items: z.array(z.lazy(() => module.exports.purchaseOrderItemSchema)).min(1, {
        message: "Danh sach hang nhap khong duoc de trong",
      }).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Du lieu cap nhat khong duoc de trong",
    }),
  validateCreate,
  validateUpdate,
};
