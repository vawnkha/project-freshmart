const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const OrdersService = require("../services/orders.service");
const PaymentsService = require("../services/payments.service");
const {
  convertVndToPaypalAmount,
  extractCapturedPaypalAmount,
  extractPaypalOrderAmount,
  paypalCreateOrder,
  paypalCaptureOrder,
  paypalGetOrder,
} = require("../utils/paypal.util");

function amountsMatch(expected, captured) {
  if (!expected || !captured || captured.amount === null) return false;
  if (expected.currency !== captured.currency) return false;
  return Number(expected.amountValue) === Number(captured.value);
}

function debugPayPal(message, data) {
  if (process.env.DEBUG_PAYPAL === "true") {
    console.log(message, data);
  }
}

exports.createOrder = async (req, res, next) => {
  try {
    const { user_id, address_id, shippingMethodId, discountCode } = req.body;

    if (!user_id || !address_id) {
      return next(new ApiError(400, "user_id và address_id là bắt buộc"));
    }

    const ordersService = new OrdersService(MongoDB.client);
    const preview = await ordersService.getCheckoutPreview({
      userId: user_id,
      addressId: address_id,
      shippingMethodId,
      discountCode,
    });

    if (preview?.error) {
      return next(new ApiError(400, preview.error));
    }

    const paypalAmount = await convertVndToPaypalAmount(preview.total_price);

    debugPayPal("[PayPal create-order pricing]", {
      subtotal: preview.subtotal_price,
      shippingFee: preview.shipping_fee,
      discountAmount: preview.discount_amount,
      finalTotalVnd: preview.total_price,
      paypalAmount: paypalAmount.amountValue,
      currency: paypalAmount.currency,
      exchangeRate: paypalAmount.exchangeRate,
      exchangeRateSource: paypalAmount.exchangeRateSource,
      exchangeRateFetchedAt: paypalAmount.exchangeRateFetchedAt,
    });

    const pp = await paypalCreateOrder({
      total: paypalAmount.amountValue,
      currency: paypalAmount.currency,
      referenceId: [user_id, address_id, shippingMethodId || "", discountCode || ""].join("|"),
    });

    if (!pp?.id) {
      return next(new ApiError(500, "Không tạo được PayPal order"));
    }

    return res.send({ id: pp.id });
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi tạo PAYPAL order"));
  }
};

exports.captureOrder = async (req, res, next) => {
  try {
    const { paypalOrderId, user_id, address_id, shippingMethodId, discountCode } =
      req.body;

    if (!paypalOrderId || !user_id || !address_id) {
      return next(
        new ApiError(400, "paypalOrderId, user_id, address_id là bắt buộc"),
      );
    }

    const ordersService = new OrdersService(MongoDB.client);
    const preview = await ordersService.getCheckoutPreview({
      userId: user_id,
      addressId: address_id,
      shippingMethodId,
      discountCode,
    });

    if (preview?.error) {
      return next(new ApiError(400, preview.error));
    }

    const expectedPaypalAmount = await convertVndToPaypalAmount(preview.total_price);
    const paypalOrder = await paypalGetOrder(paypalOrderId);
    const paypalOrderAmount = extractPaypalOrderAmount(paypalOrder);

    debugPayPal("[PayPal capture-order precheck]", {
      finalTotalVnd: preview.total_price,
      expectedPaypalAmount: expectedPaypalAmount.amountValue,
      expectedCurrency: expectedPaypalAmount.currency,
      paypalOrderAmount: paypalOrderAmount.value,
      paypalOrderCurrency: paypalOrderAmount.currency,
      exchangeRate: expectedPaypalAmount.exchangeRate,
      exchangeRateSource: expectedPaypalAmount.exchangeRateSource,
      exchangeRateFetchedAt: expectedPaypalAmount.exchangeRateFetchedAt,
    });

    if (!amountsMatch(expectedPaypalAmount, paypalOrderAmount)) {
      return next(
        new ApiError(
          400,
          "So tien PayPal order khong khop voi tong thanh toan hien tai",
        ),
      );
    }

    const captured = await paypalCaptureOrder(paypalOrderId);
    const capturedAmount = extractCapturedPaypalAmount(captured);

    debugPayPal("[PayPal capture pricing]", {
      subtotal: preview.subtotal_price,
      shippingFee: preview.shipping_fee,
      discountAmount: preview.discount_amount,
      finalTotalVnd: preview.total_price,
      expectedPaypalAmount: expectedPaypalAmount.amountValue,
      expectedCurrency: expectedPaypalAmount.currency,
      capturedAmount: capturedAmount.value,
      capturedCurrency: capturedAmount.currency,
      exchangeRate: expectedPaypalAmount.exchangeRate,
      exchangeRateSource: expectedPaypalAmount.exchangeRateSource,
      exchangeRateFetchedAt: expectedPaypalAmount.exchangeRateFetchedAt,
    });

    if (!amountsMatch(expectedPaypalAmount, capturedAmount)) {
      return next(
        new ApiError(
          400,
          "So tien PayPal capture khong khop voi tong thanh toan hien tai",
        ),
      );
    }

    const rs = await ordersService.createFromCart({
      userId: user_id,
      addressId: address_id,
      payment_method: "paypal",
      shippingMethodId,
      discountCode,
    });

    if (rs?.error || !rs?.ok || !rs?.order) {
      return next(new ApiError(400, rs?.error || "Không thể tạo đơn hàng"));
    }

    const paypalSnapshot = {
      expected_amount: expectedPaypalAmount.amountValue,
      captured_amount: capturedAmount.value,
      captured_currency: capturedAmount.currency,
      capture_id: capturedAmount.captureId,
      capture_status: capturedAmount.status,
      exchange_rate: expectedPaypalAmount.exchangeRate,
      exchangeRate: expectedPaypalAmount.exchangeRate,
      exchangeRateSource: expectedPaypalAmount.exchangeRateSource,
      exchangeRateFetchedAt: expectedPaypalAmount.exchangeRateFetchedAt,
      amount_vnd: preview.total_price,
      amountVnd: expectedPaypalAmount.amountVnd,
      amountUsd: expectedPaypalAmount.amountUsd,
    };

    await ordersService.Payment.updateOne(
      { _id: rs.payment._id },
      {
        $set: {
          method: "paypal",
          transaction_id: paypalOrderId,
          currency: "VND",
          paypal: paypalSnapshot,
          status: "completed",
          paid_at: new Date(),
          updated_at: new Date(),
        },
      },
    );

    await ordersService.Order.updateOne(
      { _id: rs.order._id },
      {
        $set: {
          paypal: paypalSnapshot,
          updated_at: new Date(),
        },
      },
    );

    return res.send({
      message: "Thanh toán thành công",
      capture: captured,
      data: rs.order,
    });
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi capture PAYPAL order"));
  }
};
