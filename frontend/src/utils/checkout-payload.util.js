export function buildCheckoutPayload({
  userId,
  addressId,
  paymentMethod,
  shippingMethodId,
  discountCode,
}) {
  return {
    user_id: userId,
    address_id: addressId,
    payment_method: paymentMethod,
    ...(shippingMethodId ? { shippingMethodId } : {}),
    ...(discountCode ? { discountCode } : {}),
  };
}
