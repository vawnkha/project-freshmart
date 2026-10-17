const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const PaypalCheckoutService = require("../services/paypal-checkout.service");
const { getPaypalCurrency } = require("../utils/paypal.util");

exports.config = (req, res) => res.send({
  clientId: process.env.PAYPAL_CLIENT_ID || "",
  currency: getPaypalCurrency(),
});

exports.createOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { address_id, shippingMethodId, discountCode } = req.body;
    if (!userId || !address_id) {
      return next(new ApiError(400, "address_id là bắt buộc"));
    }

    const result = await new PaypalCheckoutService(MongoDB.client).createOrder({
      userId,
      addressId: address_id,
      shippingMethodId,
      discountCode,
    });
    return res.send(result);
  } catch (error) {
    return next(error);
  }
};

exports.captureOrder = async (req, res, next) => {
  try {
    const paypalOrderId = String(req.body?.paypalOrderId || "").trim();
    if (!paypalOrderId) {
      return next(new ApiError(400, "paypalOrderId là bắt buộc"));
    }

    const result = await new PaypalCheckoutService(MongoDB.client).captureOrder(
      {
        userId: req.user?.id,
        paypalOrderId,
      },
    );
    return res.send({
      message: "Thanh toán thành công",
      capture: result.capture,
      data: result.order,
    });
  } catch (error) {
    if (error.code === "PAYPAL_NOT_APPROVED") return res.status(409).send({ message: error.message, code: error.code });
    return next(error);
  }
};
