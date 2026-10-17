import { z, requiredString } from "./common.validator.js";

const newPassword = z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự").max(128, "Mật khẩu tối đa 128 ký tự").refine((value) => !!value.trim(), "Vui lòng nhập mật khẩu mới");
const confirmation = z.string().min(1, "Vui lòng xác nhận mật khẩu");
export const resetPasswordSchema = z.object({ newPassword, confirmPassword: confirmation })
  .refine((value) => value.newPassword === value.confirmPassword, { path: ["confirmPassword"], message: "Mật khẩu xác nhận không khớp" });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"), newPassword, confirmPassword: confirmation,
}).refine((value) => value.newPassword === value.confirmPassword, { path: ["confirmPassword"], message: "Mật khẩu xác nhận không khớp" });
export const accountSchema = z.object({
  name: requiredString("Vui lòng nhập họ và tên").pipe(z.string().max(120, "Họ và tên tối đa 120 ký tự")),
  phone: z.string().trim().max(30, "Số điện thoại tối đa 30 ký tự"),
  address: z.string().trim().max(500, "Địa chỉ tối đa 500 ký tự"),
});
export const addressSchema = z.object({
  full_name: requiredString("Vui lòng nhập họ và tên"),
  address: requiredString("Vui lòng nhập địa chỉ"),
  city: requiredString("Vui lòng nhập tỉnh / thành phố"),
  phone: requiredString("Vui lòng nhập số điện thoại"),
});
