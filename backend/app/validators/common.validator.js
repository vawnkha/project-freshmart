const { ObjectId } = require("mongodb");
const { z } = require("zod");

function emptyToUndefined(value) {
  return value === "" || value === null ? undefined : value;
}

function numberFromForm(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  return Number(value);
}

const objectIdSchema = z
  .string()
  .refine((value) => ObjectId.isValid(value), "ObjectId khong hop le");

const optionalObjectIdSchema = z.preprocess(
  emptyToUndefined,
  objectIdSchema.optional(),
);

const objectIdArraySchema = z.array(objectIdSchema).default([]);

const idParamSchema = z.object({
  id: objectIdSchema,
});

const nonEmptyString = z.preprocess(
  (value) => (value === undefined || value === null ? "" : value),
  z.string().trim().min(1, "Truong nay la bat buoc"),
);

const optionalString = z
  .preprocess((value) => (value === null || value === undefined ? undefined : value), z.string().optional())
  .transform((value) => (value === undefined ? value : String(value).trim()));

const slugSchema = z.preprocess(
  (value) => (value === undefined || value === null ? "" : value),
  z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug khong hop le"),
);

const optionalSlugSchema = z.preprocess(
  emptyToUndefined,
  slugSchema.optional(),
);

const emailSchema = z.preprocess(
  (value) => (value === undefined || value === null ? "" : value),
  z.string().trim().email("Email khong hop le"),
);

const moneySchema = z.preprocess(
  numberFromForm,
  z.number({ message: "Gia tri phai la so" }).min(0, "Gia tri phai lon hon hoac bang 0"),
);

const positiveNumberSchema = z.preprocess(
  numberFromForm,
  z.number({ message: "Gia tri phai la so" }).positive("Gia tri phai lon hon 0"),
);

const nonNegativeNumberSchema = z.preprocess(
  numberFromForm,
  z.number({ message: "Gia tri phai la so" }).min(0, "Gia tri phai lon hon hoac bang 0"),
);

const optionalNonNegativeNumberSchema = z.preprocess(
  numberFromForm,
  z.number({ message: "Gia tri phai la so" }).min(0, "Gia tri phai lon hon hoac bang 0").optional(),
);

const dateStringSchema = z
  .union([
    z.literal(""),
    z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Ngay khong hop le",
    }),
  ])
  .optional();

const statusEnum = z.enum(["active", "inactive"], {
  message: "Trang thai khong hop le",
});

const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean().optional());

module.exports = {
  booleanQuerySchema,
  dateStringSchema,
  emailSchema,
  idParamSchema,
  moneySchema,
  nonEmptyString,
  nonNegativeNumberSchema,
  objectIdSchema,
  objectIdArraySchema,
  optionalNonNegativeNumberSchema,
  optionalObjectIdSchema,
  optionalSlugSchema,
  optionalString,
  positiveNumberSchema,
  slugSchema,
  statusEnum,
};
