const crypto = require("crypto");
const ApiError = require("../api-error");
const OrdersService = require("./orders.service");
const PaymentIntentService = require("./payment-intent.service");
const { checkoutFingerprint } = require("../utils/checkout-fingerprint.util");
const {
  convertVndToPaypalAmount,
  extractCapturedPaypalAmount,
  extractPaypalOrderAmount,
  paypalCreateOrder,
  paypalCaptureOrder,
  paypalGetOrder,
} = require("../utils/paypal.util");

function amountsMatch(expected, actual) {
  if (!expected || !actual || actual.amount === null) return false;
  if (String(expected.currency) !== String(actual.currency)) return false;
  return Number(expected.amountValue) === Number(actual.value);
}

class PaypalCheckoutService {
  constructor(client) {
    this.orders = new OrdersService(client);
    this.intents = new PaymentIntentService(client);
  }

  // Recovery observes the provider; it never creates, captures, refunds or releases stock.
  async reconcileOrder({ userId, paypalOrderId }) {
    const intent = await this.intents.findOwned(paypalOrderId, userId);
    const payment = await this.orders.findPaymentByIdempotencyKey(paypalOrderId);
    if (!intent || !payment || payment.method !== "paypal") return { status: "missing" };
    if (String(payment.user_id) !== String(intent.userId)) throw new ApiError(409, "Payment ownership mismatch");
    if (payment.status === "completed") {
      if (intent.status !== "captured") await this.intents.markStatus(paypalOrderId, "captured", {
        captureId: payment.paypal?.capture_id, capturedAt: payment.paid_at,
      });
      return { status: "completed" };
    }
    if (!["awaiting_capture", "capture_unknown"].includes(payment.status)) return { status: "terminal" };
    if (intent.status === "manual_review") return { status: "manual_review" };
    let provider;
    try { provider = await paypalGetOrder(paypalOrderId); }
    catch (_) { throw new ApiError(502, "PayPal reconciliation provider query failed"); }
    const expected = { amountValue: intent.expectedAmount, currency: intent.expectedCurrency };
    const captured = extractCapturedPaypalAmount(provider);
    const providerStatus = String(provider?.status || "").toUpperCase();
    if (String(provider?.id) !== String(paypalOrderId) || !amountsMatch(expected, extractPaypalOrderAmount(provider))) {
      await this.intents.markStatus(paypalOrderId, "manual_review", { reconciliationOutcome: "amount_or_id_mismatch" });
      return { status: "manual_review", providerStatus };
    }
    if (providerStatus !== "COMPLETED" || captured?.status !== "COMPLETED" || !captured?.captureId)
      return { status: "pending", providerStatus };
    if (!amountsMatch(expected, captured)) {
      await this.intents.markStatus(paypalOrderId, "manual_review", { reconciliationOutcome: "capture_amount_mismatch" });
      return { status: "manual_review", providerStatus };
    }
    const snapshot = {
      expected_amount: intent.expectedAmount,
      captured_amount: captured.value, captured_currency: intent.expectedCurrency,
      capture_id: captured.captureId, capture_status: captured.status,
      exchange_rate: intent.exchangeRate, exchange_rate_source: intent.exchangeRateSource,
      exchange_rate_fetched_at: intent.exchangeRateFetchedAt, amount_vnd: intent.amountVnd,
    };
    await this.orders.finalizePaypalPayment(paypalOrderId, snapshot);
    await this.intents.markStatus(paypalOrderId, "captured", { captureId: captured.captureId, capturedAt: new Date(), reconciledAt: new Date() });
    return { status: "completed", providerStatus };
  }

  async createOrder({ userId, addressId, shippingMethodId, discountCode }) {
    const preview = await this.orders.getCheckoutPreview({
      userId,
      addressId,
      shippingMethodId,
      discountCode,
    });
    if (preview?.error) throw new ApiError(400, preview.error);

    const amount = await convertVndToPaypalAmount(preview.total_price);
    const requestId = crypto.randomUUID();
    let paypalOrder;
    try {
      paypalOrder = await paypalCreateOrder({
        total: amount.amountValue,
        currency: amount.currency,
        referenceId: requestId,
        requestId,
      });
    } catch (_) {
      throw new ApiError(502, "Không thể khởi tạo thanh toán PayPal");
    }
    if (!paypalOrder?.id)
      throw new ApiError(502, "Không tạo được PayPal order");

    await this.intents.create({
      paypalOrderId: paypalOrder.id,
      userId,
      addressId,
      shippingMethodId,
      discountCode,
      expectedAmount: amount.amountValue,
      expectedCurrency: amount.currency,
      amountVnd: preview.total_price,
      checkoutFingerprint: checkoutFingerprint(preview),
      exchangeRate: amount.exchangeRate,
      exchangeRateSource: amount.exchangeRateSource,
      exchangeRateFetchedAt: amount.exchangeRateFetchedAt,
    });
    return { id: paypalOrder.id };
  }

  async captureOrder({ userId, paypalOrderId }) {
    const intent = await this.intents.findOwned(paypalOrderId, userId);
    if (!intent) throw new ApiError(404, "Giao dịch PayPal không tồn tại");

    const existingPayment =
      await this.orders.findPaymentByIdempotencyKey(paypalOrderId);
    if (existingPayment && ["refunded", "refund_pending", "failed", "canceled"].includes(existingPayment.status)) {
      throw new ApiError(409, "Giao dịch đã hủy hoặc đang hoàn tiền, không thể capture lại");
    }
    if (!existingPayment) {
      if (new Date(intent.expiresAt) <= new Date()) {
        throw new ApiError(409, "Giao dịch PayPal đã hết hạn. Vui lòng tạo thanh toán mới.");
      }
      const preview = await this.orders.getCheckoutPreview({
        userId: intent.userId,
        addressId: intent.addressId,
        shippingMethodId: intent.shippingMethodId,
        discountCode: intent.discountCode,
      });
      if (preview?.error) throw new ApiError(409, preview.error);
      if (Number(preview.total_price) !== Number(intent.amountVnd)
        || (intent.checkoutFingerprint && checkoutFingerprint(preview) !== intent.checkoutFingerprint)) {
        throw new ApiError(
          409,
          "Giỏ hàng đã thay đổi, vui lòng tạo lại thanh toán",
        );
      }
    }

    const expectedAmount = {
      amountValue: intent.expectedAmount,
      currency: intent.expectedCurrency,
    };
    let paypalOrder;
    try {
      paypalOrder = await paypalGetOrder(paypalOrderId);
    } catch (_) {
      throw new ApiError(502, "Không thể kiểm tra trạng thái PayPal");
    }
    if (!amountsMatch(expectedAmount, extractPaypalOrderAmount(paypalOrder))) {
      throw new ApiError(400, "Số tiền PayPal không khớp đơn hàng");
    }
    // Approval must be verified before reserving stock or clearing the cart.
    if (!["APPROVED", "COMPLETED"].includes(paypalOrder.status)) {
      const error = new ApiError(409, "PayPal order chưa được phê duyệt");
      error.code = "PAYPAL_NOT_APPROVED";
      throw error;
    }
    if (existingPayment?.status === "completed") {
      await this.intents.markStatus(paypalOrderId, "captured", {
        capturedAt: existingPayment.paid_at,
        captureId: existingPayment.paypal?.capture_id,
      });
      return { capture: paypalOrder, order: await this.orders.getOrderDetail(String(existingPayment.order_id)) };
    }

    const localOrder = await this.orders.createFromCart({
      userId: intent.userId,
      addressId: intent.addressId,
      payment_method: "paypal",
      expectedCheckoutFingerprint: intent.checkoutFingerprint,
      expectedTotalVnd: intent.amountVnd,
      shippingMethodId: intent.shippingMethodId,
      discountCode: intent.discountCode,
      orderStatus: "awaiting_payment",
      paymentStatus: "awaiting_capture",
      transactionId: paypalOrderId,
      idempotencyKey: paypalOrderId,
      paymentMetadata: {
        currency: "VND",
        paypal: {
          expected_amount: intent.expectedAmount,
          expected_currency: intent.expectedCurrency,
          amount_vnd: intent.amountVnd,
          exchange_rate: intent.exchangeRate,
          exchange_rate_source: intent.exchangeRateSource,
          exchange_rate_fetched_at: intent.exchangeRateFetchedAt,
        },
      },
    });
    if (localOrder?.error || !localOrder?.ok) {
      throw new ApiError(409, localOrder?.error || "Không thể tạo đơn hàng");
    }

    await this.intents
      .markStatus(paypalOrderId, "capturing", {
        orderId: localOrder.order._id,
      });
    try {
      if (paypalOrder.status !== "COMPLETED") {
        if (paypalOrder.status !== "APPROVED") {
          throw new ApiError(409, "PayPal order chưa được phê duyệt");
        }
        paypalOrder = await paypalCaptureOrder(paypalOrderId, {
          requestId: `capture-${paypalOrderId}`,
        });
      }
    } catch (error) {
      if (error?.statusCode) throw error;
      await this.orders.markPaypalCaptureUnknown(paypalOrderId, error.message);
      await this.intents.markStatus(paypalOrderId, "capture_unknown");
      throw new ApiError(
        502,
        "Chưa xác định được kết quả capture PayPal; có thể thử lại an toàn",
      );
    }

    const capturedAmount = extractCapturedPaypalAmount(paypalOrder);
    if (capturedAmount.status !== "COMPLETED" || !capturedAmount.captureId) {
      await this.orders.markPaypalCaptureUnknown(paypalOrderId, "Capture is not completed");
      await this.intents.markStatus(paypalOrderId, "capture_unknown");
      throw new ApiError(502, "PayPal chưa xác nhận thanh toán hoàn tất; vui lòng kiểm tra lại giao dịch này");
    }
    if (!amountsMatch(expectedAmount, capturedAmount)) {
      await this.orders.markPaypalCaptureUnknown(
        paypalOrderId,
        "Captured amount does not match the approved amount",
      );
      await this.intents.markStatus(paypalOrderId, "manual_review");
      throw new ApiError(409, "Số tiền capture PayPal không khớp");
    }

    const paypalSnapshot = {
      expected_amount: intent.expectedAmount,
      captured_amount: capturedAmount.value,
      captured_currency: capturedAmount.currency,
      capture_id: capturedAmount.captureId,
      capture_status: capturedAmount.status,
      exchange_rate: intent.exchangeRate,
      exchange_rate_source: intent.exchangeRateSource,
      exchange_rate_fetched_at: intent.exchangeRateFetchedAt,
      amount_vnd: intent.amountVnd,
    };

    let order;
    try {
      order = await this.orders.finalizePaypalPayment(
        paypalOrderId,
        paypalSnapshot,
      );
    } catch (_) {
      await this.orders.markPaypalCaptureUnknown(
        paypalOrderId,
        "PayPal captured but local finalization must be retried",
      );
      await this.intents.markStatus(paypalOrderId, "capture_unknown");
      throw new ApiError(
        502,
        "Thanh toán đã được PayPal xử lý; vui lòng thử lại để hoàn tất đơn hàng",
      );
    }
    await this.intents
      .markStatus(paypalOrderId, "captured", {
        capturedAt: new Date(),
        captureId: capturedAmount.captureId,
      });

    return { capture: paypalOrder, order };
  }
}

module.exports = PaypalCheckoutService;
