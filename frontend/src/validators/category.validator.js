import {
  imageFileSchema,
  optionalString,
  requiredString,
  slugSchema,
  z,
} from "./common.validator";

export const categoryFormSchema = z.object({
  name: requiredString("Tên danh mục là bắt buộc"),
  slug: slugSchema,
  description: optionalString,
  image: imageFileSchema,
});
