const { z } = require("zod");
const {
  nonEmptyString,
  nonNegativeNumberSchema,
  optionalObjectIdSchema,
  optionalString,
} = require("./common.validator");

const inventoryItemStatusSchema = z.enum(["active", "inactive", "discontinued"], {
  message: "Trang thai hang kho khong hop le",
});

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateCreate(payload = {}) {
  if (!hasValue(payload.itemCode)) return "itemCode la bat buoc";
  if (!hasValue(payload.itemName)) return "itemName la bat buoc";
  if (!hasValue(payload.unit)) return "unit la bat buoc";
  return null;
}

function validateUpdate(payload = {}) {
  return Object.keys(payload || {}).length
    ? null
    : "Du lieu cap nhat khong duoc de trong";
}

module.exports = {
  inventoryItemQuerySchema: z.object({
    status: inventoryItemStatusSchema.optional(),
    itemType: optionalString,
    categoryId: optionalObjectIdSchema,
    keyword: optionalString,
  }),
  createInventoryItemSchema: z.object({
    categoryId: optionalObjectIdSchema,
    brandId: optionalObjectIdSchema,
    manufacturerId: optionalObjectIdSchema,
    itemCode: nonEmptyString,
    itemName: nonEmptyString,
    itemType: optionalString,
    barcode: optionalString,
    packageSize: optionalString,
    unit: nonEmptyString,
    storageInstruction: optionalString,
    expiryMonths: nonNegativeNumberSchema.optional(),
    note: optionalString,
    status: inventoryItemStatusSchema.optional(),
  }),
  updateInventoryItemSchema: z
    .object({
      categoryId: optionalObjectIdSchema,
      brandId: optionalObjectIdSchema,
      manufacturerId: optionalObjectIdSchema,
      itemCode: nonEmptyString.optional(),
      itemName: nonEmptyString.optional(),
      itemType: optionalString,
      barcode: optionalString,
      packageSize: optionalString,
      unit: nonEmptyString.optional(),
      storageInstruction: optionalString,
      expiryMonths: nonNegativeNumberSchema.optional(),
      note: optionalString,
      status: inventoryItemStatusSchema.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Du lieu cap nhat khong duoc de trong",
    }),
  validateCreate,
  validateUpdate,
};
