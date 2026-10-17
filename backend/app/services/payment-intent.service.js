const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

class PaymentIntentService {
  constructor(client) {
    const ResourceDeletionService = require("./resource-deletion.service");
    this.deletion = new ResourceDeletionService(client);
    this.PaymentIntent = client.db().collection("payment_intents");
  }

  async create(data) {
    const document = {
      paypalOrderId: String(data.paypalOrderId),
      userId: toObjectId(data.userId),
      addressId: toObjectId(data.addressId),
      shippingMethodId: toObjectId(data.shippingMethodId),
      discountCode: data.discountCode ? String(data.discountCode).trim() : "",
      expectedAmount: String(data.expectedAmount),
      expectedCurrency: String(data.expectedCurrency),
      amountVnd: Number(data.amountVnd),
      ...(data.checkoutFingerprint ? { checkoutFingerprint: data.checkoutFingerprint } : {}),
      exchangeRate: Number(data.exchangeRate),
      exchangeRateSource: data.exchangeRateSource || "",
      exchangeRateFetchedAt: data.exchangeRateFetchedAt || null,
      status: "created",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    const references = [
      { collection: "users", id: document.userId },
      { collection: "addresses", id: document.addressId },
      { collection: "shipping_methods", id: document.shippingMethodId },
    ];
    const result = await this.deletion.withReferences(references, async (session) => {
      if (document.discountCode) {
        const discount = await this.deletion.db.collection("discounts").findOne({ code: document.discountCode }, { session });
        if (!discount) throw new ApiError(409, "Mã giảm giá không còn tồn tại.", "REFERENCE_NOT_FOUND");
        await this.deletion.withReferences([{ collection: "discounts", id: discount._id }], async () => {}, { session });
      }
      return this.PaymentIntent.insertOne(document, { session });
    });
    return { _id: result.insertedId, ...document };
  }

  async findOwned(paypalOrderId, userId) {
    const uid = toObjectId(userId);
    if (!uid) throw new ApiError(401, "Tài khoản không hợp lệ");
    const intent = await this.PaymentIntent.findOne({
      paypalOrderId: String(paypalOrderId),
    });
    if (!intent) return null;
    if (String(intent.userId) !== String(uid)) {
      throw new ApiError(403, "Bạn không có quyền sử dụng giao dịch này");
    }
    return intent;
  }

  markStatus(paypalOrderId, status, extra = {}) {
    return this.PaymentIntent.findOneAndUpdate(
      { paypalOrderId: String(paypalOrderId), ...(status !== "captured" ? { status: { $ne: "captured" } } : {}) },
      { $set: { status, ...extra, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  }
}

module.exports = PaymentIntentService;
