import { z } from "zod";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;

function numberFromForm(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim() ? Number(value) : undefined;
  return value;
}

export const requiredString = (message = "Trường này là bắt buộc") =>
  z.preprocess(
    (value) => (value === undefined || value === null ? "" : value),
    z.string().trim().min(1, message),
  );

export const optionalString = z
  .preprocess((value) => (value === null || value === undefined ? "" : value), z.string())
  .transform((value) => String(value).trim())
  .optional();

export const emailSchema = z.preprocess(
  (value) => (value === undefined || value === null ? "" : value),
  z.string().trim().email("Email không hợp lệ"),
);

export const optionalEmailSchema = z
  .union([z.literal(""), emailSchema])
  .optional();

export const passwordSchema = z.string().min(1, "Mật khẩu là bắt buộc");

export const slugSchema = z.preprocess(
  (value) => (value === undefined || value === null ? "" : value),
  z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug khong hop le"),
);

export const optionalSlugSchema = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  slugSchema.optional(),
);

export const objectIdSchema = z.preprocess(
  (value) => (value === undefined || value === null ? "" : String(value)),
  z.string().regex(/^[a-f\d]{24}$/i, "ObjectId khong hop le"),
);

export const optionalObjectIdSchema = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : String(value)),
  objectIdSchema.optional(),
);

export const objectIdArraySchema = z.array(objectIdSchema);

export const moneySchema = z.preprocess(
  numberFromForm,
  z.number({ message: "Gia tri phai la so" }).min(0, "Gia tri phai lon hon hoac bang 0"),
);

export const positiveNumberSchema = z.preprocess(
  numberFromForm,
  z.number({ message: "Gia tri phai la so" }).positive("Gia tri phai lon hon 0"),
);

export const nonNegativeNumberSchema = z.preprocess(
  numberFromForm,
  z.number({ message: "Gia tri phai la so" }).min(0, "Gia tri phai lon hon hoac bang 0"),
);

export const optionalNonNegativeNumberSchema = z.preprocess(
  numberFromForm,
  z.number({ message: "Gia tri phai la so" }).min(0, "Gia tri phai lon hon hoac bang 0").optional(),
);

export const dateStringSchema = z
  .union([
    z.literal(""),
    z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Ngay khong hop le",
    }),
  ])
  .optional();

export const statusSchema = z.enum(["active", "inactive"], {
  message: "Trang thai khong hop le",
});

export const imageFileSchema = z
  .custom(
    (file) =>
      file === null ||
      file === undefined ||
      (typeof File !== "undefined" && file instanceof File),
    { message: "Tệp ảnh không hợp lệ" },
  )
  .refine((file) => !file || IMAGE_TYPES.includes(file.type), {
    message: "Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF",
  })
  .refine((file) => !file || file.size <= IMAGE_MAX_SIZE, {
    message: "Mỗi ảnh tối đa 10 MB",
  });

export { z };
