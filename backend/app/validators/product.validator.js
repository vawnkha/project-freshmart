const { z } = require("zod");
const { technicalSpecsSchema, packageMeasureSchema, jsonField } = require("./technical-specs.validator");
const directProductFields = {
  technicalSpecs: jsonField(technicalSpecsSchema).optional(),
  packageMeasure: jsonField(packageMeasureSchema.nullable()).optional(),
  packageSize: z.string().trim().max(160).optional(),
  storageInstruction: z.string().trim().max(2000).optional(),
  expiryMonths: z.preprocess(value => value === "" || value === null ? null : typeof value === "string" ? Number(value) : value, z.number().finite().min(0).max(1200).nullable()).optional(),
};
const {
  idParamSchema,
  nonEmptyString,
  objectIdSchema,
  optionalNonNegativeNumberSchema,
  optionalObjectIdSchema,
  optionalSlugSchema,
  optionalString,
} = require("./common.validator");

const sellingPriceSchema = z.preprocess(
  value => value === null || value === '' ? null : typeof value === 'string' ? Number(value) : value,
  z.number().finite().min(0).nullable().optional(),
);

const catalogReferenceSchema = z.preprocess(
  value => value === '' || value === null ? null : value,
  objectIdSchema.nullable().optional(),
);

const productStatusSchema = z.enum(
  ["draft", "active", "inactive", "out_of_stock", "out_stock", "in_stock"],
  { message: "status khong hop le" },
);

const inventoryProductStatusSchema = z.enum(["draft", "active", "inactive"], {
  message: "status khong hop le",
});

const imagesSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return Array.isArray(value) ? value : [value];
}, z.array(z.string()).optional());

const productQuerySchema = z.object({
  q: optionalString,
  name: optionalString,
  search: optionalString,
  keyword: optionalString,
  category_id: optionalObjectIdSchema,
  category_slug: optionalString,
  unit: z.preprocess(
    (value) => value === undefined || value === "" ? undefined : Array.isArray(value) ? value : [value],
    z.array(z.string().trim().min(1)).optional(),
  ),
  include_units: z.literal("1").optional(),
  status: z.preprocess(
    (value) => (value === "" ? undefined : value),
    productStatusSchema.optional(),
  ),
});

const productCategoryParamSchema = z.object({
  categoryId: objectIdSchema,
});

const productCreateSchema = z
  .object({
    ...directProductFields,
    brandId: catalogReferenceSchema,
    manufacturerId: catalogReferenceSchema,
    name: nonEmptyString,
    slug: optionalSlugSchema,
    inventoryItemId: optionalObjectIdSchema,
    productCode: optionalString,
    sellingPrice: sellingPriceSchema,
    price: sellingPriceSchema,
    comparePrice: optionalNonNegativeNumberSchema,
    stock: optionalNonNegativeNumberSchema,
    category_id: optionalObjectIdSchema,
    unit: optionalString,
    thumbnail: optionalString,
    images: imagesSchema,
    description: optionalString,
    shortDescription: optionalString,
    status: productStatusSchema.optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (!value.category_id && !value.inventoryItemId) {
      ctx.addIssue({
        code: "custom",
        path: ["category_id"],
        message: "category_id hoac inventoryItemId la bat buoc",
      });
    }
  });

const productUpdateSchema = z
  .object({
    ...directProductFields,
    brandId: catalogReferenceSchema,
    manufacturerId: catalogReferenceSchema,
    name: nonEmptyString.optional(),
    slug: optionalSlugSchema,
    inventoryItemId: optionalObjectIdSchema,
    productCode: optionalString,
    sellingPrice: sellingPriceSchema,
    price: sellingPriceSchema,
    comparePrice: optionalNonNegativeNumberSchema,
    stock: optionalNonNegativeNumberSchema,
    category_id: optionalObjectIdSchema,
    unit: optionalString,
    thumbnail: optionalString,
    images: imagesSchema,
    description: optionalString,
    shortDescription: optionalString,
    status: productStatusSchema.optional(),
  })
  .passthrough()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Du lieu de cap nhat khong duoc de trong",
  });

const createProductFromInventoryParamSchema = z.object({
  inventoryItemId: objectIdSchema,
});

const createProductFromInventorySchema = z
  .object({
    ...directProductFields,
    name: optionalString,
    slug: optionalSlugSchema,
    productCode: optionalString,
    sellingPrice: sellingPriceSchema,
    price: sellingPriceSchema,
    comparePrice: optionalNonNegativeNumberSchema,
    thumbnail: optionalString,
    images: imagesSchema,
    shortDescription: optionalString,
    description: optionalString,
    status: inventoryProductStatusSchema.optional(),
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

function validateCreateProduct(req) {
  const body = req.body || {};
  if (!hasValue(body.name)) return bad("name la bat buoc");
  if (!hasValue(body.category_id) && !hasValue(body.inventoryItemId)) {
    return bad("category_id la bat buoc");
  }
  return ok();
}

function validateUpdateProduct(req) {
  return Object.keys(req.body || {}).length
    ? ok()
    : bad("Du lieu de cap nhat khong duoc de trong");
}

function validateProductCreateData(body = {}) {
  if (!hasValue(body.name)) return "name la bat buoc";
  if (!hasValue(body.category_id) && !hasValue(body.inventoryItemId)) {
    return "category_id la bat buoc";
  }
  return null;
}

function validateProductUpdateData(body = {}) {
  return Object.keys(body || {}).length
    ? null
    : "Du lieu de cap nhat khong duoc de trong";
}

function validateCreateFromInventory(body = {}) {
  if (body.sellingPrice !== undefined && Number(body.sellingPrice) < 0) {
    return "sellingPrice khong hop le";
  }
  if (body.price !== undefined && Number(body.price) < 0) {
    return "price khong hop le";
  }
  return null;
}

module.exports = {
  productMetadataSchema: z.object(directProductFields),
  compareQuerySchema: z.object({ ids: z.string().max(120).transform(value => [...new Set(value.split(",").map(id => id.trim().toLowerCase()))])
    .pipe(z.array(z.string().regex(/^[a-f0-9]{24}$/, "Product ID không hợp lệ")).min(2, "Chọn ít nhất 2 sản phẩm khác nhau").max(3, "Chỉ so sánh tối đa 3 sản phẩm")) }),
  createProductFromInventoryParamSchema,
  createProductFromInventorySchema,
  productCategoryParamSchema,
  productCreateSchema,
  productIdParamSchema: idParamSchema,
  productQuerySchema,
  productUpdateSchema,
  validateCreateProduct,
  validateUpdateProduct,
  validateProductCreateData,
  validateProductUpdateData,
  validateCreateFromInventory,
};
