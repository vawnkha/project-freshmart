import { optionalString, z } from "./common.validator.js";
import { PAYMENT_METHODS } from "../constants/checkout.js";

export const checkoutSchema = z.object({
  addressId: z
    .string()
    .min(1, "Vui lòng chọn địa chỉ giao hàng")
    .regex(/^[a-f\d]{24}$/i, "ObjectId không hợp lệ"),
  paymentMethod: z.enum([PAYMENT_METHODS.COD, PAYMENT_METHODS.PAYPAL], {
    message: "Phương thức thanh toán không hợp lệ",
  }),
  shippingMethodId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "ObjectId không hợp lệ")
    .optional(),
  discountCode: optionalString,
});
