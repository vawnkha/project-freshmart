import {
  imageFileSchema,
  optionalString,
  requiredString,
  optionalSlugSchema,
  z,
} from "./common.validator";

export const categoryFormSchema = z.object({
  name: requiredString("Tên danh mục là bắt buộc"),
  slug: optionalSlugSchema,
  description: optionalString,
  image: imageFileSchema,
});
