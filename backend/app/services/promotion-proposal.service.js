const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const InventoryStockService = require("./inventory-stock.service");
const { toObjectId } = require("../utils/inventory-query.util");
const { classifyExpiry, isBatchSellable, calendarDate } = require("../utils/expiry.util");
const config = require("../config/expiry");

class PromotionProposalService {
  constructor(client) {
    this.client = client;
    const db = client.db();
    this.Proposal = db.collection("promotion_proposals");
    this.Discount = db.collection("discounts");
    this.Batch = db.collection("inventory_batches");
    this.Product = db.collection("products");
    this.stock = new InventoryStockService(client);
    this.deletion = new (require("./resource-deletion.service"))(client);
  }
  actor(user) { return toObjectId(user?.id || user?._id); }
  history(action, user, detail = {}) { return { action, actorId: this.actor(user), at: new Date(), ...detail }; }
  async context(id, { session, now = new Date() } = {}) {
    const batch = await this.Batch.findOne({ _id: toObjectId(id) }, { session });
    if (!batch) throw new ApiError(404, "Lô hàng không tồn tại");
    const product = await this.Product.findOne({ inventoryItemId: batch.inventoryItemId }, { session });
    const expiry = classifyExpiry(batch.expiryDate instanceof Date ? batch.expiryDate : null, now);
    const price = Number(product?.sellingPrice ?? product?.price);
    const item = await this.client.db().collection("inventory_items").findOne({ _id: batch.inventoryItemId }, { session });
    if (!isBatchSellable(batch, now) || !["warning", "urgent"].includes(expiry.expiryStatus)
      || product?.status !== "active" || (item?.status && item.status !== "active") || !item || !(price > 0)) {
      throw new ApiError(409, "Lô phải còn tồn, có hạn sử dụng trong ngưỡng cảnh báo và sản phẩm đang bán với giá hợp lệ");
    }
    return { batch, product, price, expiry };
  }
  async recommendation(id, options = {}) {
    const { batch, product, price, expiry } = await this.context(id, options);
    const suggestedPercent = Math.min(config.maxDiscount, expiry.expiryStatus === "urgent" ? config.urgentDiscount : config.warningDiscount);
    return { batchId: batch._id, batchNumber: batch.batchNumber, productId: product._id, productName: product.name,
      expiryDate: batch.expiryDate, ...expiry, originalPrice: price, suggestedPercent, maxPercent: config.maxDiscount,
      discountedPrice: price - Math.floor(price * suggestedPercent / 100), availableQuantity: batch.quantity,
      startDate: options.now || new Date(), endDate: expiry.sellableUntil };
  }
  validateTerms(payload, context, now = new Date()) {
    const percent = Number(payload.percent), quantity = Number(payload.quantity);
    // Require offsets: datetime-local without a zone must never depend on server TZ.
    const zoned = value => value instanceof Date || (typeof value === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(value));
    const startDate = new Date(payload.startDate), endDate = new Date(payload.endDate);
    if (!(percent > 0 && percent <= config.maxDiscount)) throw new ApiError(400, `Mức giảm phải từ trên 0 đến ${config.maxDiscount}%`);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > Number(context.batch.quantity)) throw new ApiError(409, "Số lượng khuyến mãi vượt tồn khả dụng");
    if (!zoned(payload.startDate) || !zoned(payload.endDate) || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())
      || endDate <= startDate || endDate <= now || endDate > context.expiry.sellableUntil) {
      throw new ApiError(400, "Thời gian không hợp lệ; kết thúc phải trước hoặc bằng 00:00 ngày hết hạn tại Việt Nam");
    }
    return { percent, quantity, startDate, endDate, note: String(payload.note || "").trim().slice(0, 2000) };
  }
  async create(batchId, payload, user) {
    await this.syncLifecycle(new Date(), batchId);
    return this.stock.withTransaction({}, async session => {
      const batch = await this.Batch.findOne({ _id: toObjectId(batchId) }, { session });
      if (!batch) throw new ApiError(404, "Lô hàng không tồn tại");
      await this.stock.acquireItem(batch.inventoryItemId, session, { requireActive: true });
      const context = await this.context(batchId, { session });
      await this.deletion.withReferences([{ collection: "products", id: context.product._id }, { collection: "users", id: this.actor(user) }], async () => {}, { session });
      if (await this.Proposal.findOne({ batchId: batch._id, open: true }, { session })) throw new ApiError(409, "Lô đã có đề xuất đang xử lý hoặc khuyến mãi còn hiệu lực");
      const terms = this.validateTerms(payload, context);
      const recommendation = await this.recommendation(batchId, { session });
      const status = payload.status === "draft" ? "draft" : "pending";
      const doc = { batchId: batch._id, productId: context.product._id, inventoryItemId: batch.inventoryItemId,
        ...terms, originalPrice: context.price, suggestedPercent: recommendation.suggestedPercent,
        discountedPrice: context.price - Math.floor(context.price * terms.percent / 100),
        approvalStatus: status, status, open: true, createdBy: this.actor(user), createdAt: new Date(), updatedAt: new Date(),
        history: [this.history("created", user, { ...terms })] };
      const result = await this.Proposal.insertOne(doc, { session });
      return { _id: result.insertedId, ...doc };
    });
  }
  async mutate(id, user, callback) {
    return this.stock.withTransaction({}, async session => {
      const proposal = await this.Proposal.findOne({ _id: toObjectId(id) }, { session });
      if (!proposal) throw new ApiError(404, "Đề xuất không tồn tại");
      await this.stock.acquireItem(proposal.inventoryItemId, session);
      if (this.actor(user)) await this.deletion.withReferences([{ collection: "users", id: this.actor(user) }], async () => {}, { session });
      return callback(proposal, session);
    });
  }
  async update(id, payload, user) {
    return this.mutate(id, user, async (proposal, session) => {
      if (!["draft", "pending"].includes(proposal.status)) throw new ApiError(409, "Đề xuất đã được xử lý");
      if (String(proposal.createdBy) !== String(this.actor(user))) throw new ApiError(403, "Chỉ người tạo được sửa đề xuất");
      const context = await this.context(proposal.batchId, { session });
      const terms = this.validateTerms({ ...proposal, ...payload }, context);
      const status = payload.status === "pending" ? "pending" : proposal.status;
      return this.Proposal.findOneAndUpdate({ _id: proposal._id, status: proposal.status }, {
        $set: { ...terms, status, approvalStatus: status, originalPrice: context.price,
          discountedPrice: context.price - Math.floor(context.price * terms.percent / 100), updatedAt: new Date(), updatedBy: this.actor(user) },
        $push: { history: this.history("edited", user, terms) },
      }, { session, returnDocument: "after" });
    });
  }
  async approve(id, payload, user) {
    return this.mutate(id, user, async (proposal, session) => {
      if (proposal.status !== "pending") throw new ApiError(409, "Chỉ được duyệt đề xuất đang chờ xử lý");
      const now = new Date();
      const context = await this.context(proposal.batchId, { session, now });
      await this.Product.updateOne({ _id: context.product._id }, { $inc: { stockVersion: 1 } }, { session });
      const terms = this.validateTerms({ ...proposal, ...payload }, context, now);
      const discountId = new ObjectId();
      const code = `HSD${discountId.toHexString().toUpperCase()}`;
      const status = terms.startDate > now ? "approved" : "active";
      const discount = { _id: discountId, code, name: `Ưu đãi lô ${context.batch.batchNumber}`, description: terms.note,
        scope: "batch", type: "percent", value: terms.percent, batchId: proposal.batchId, proposalId: proposal._id,
        applicable: { productIds: [context.product._id], categoryIds: [], batchIds: [proposal.batchId] },
        batchQuantity: terms.quantity, usedQuantity: 0, quantity: 0, usedCount: 0, minOrderValue: 0, maxDiscountAmount: 0,
        startDate: terms.startDate, endDate: terms.endDate, status: "active", isPublic: true, createdAt: now, updatedAt: now };
      await this.Discount.insertOne(discount, { session });
      return this.Proposal.findOneAndUpdate({ _id: proposal._id, status: "pending" }, {
        $set: { ...terms, approvedPercent: terms.percent, originalPrice: context.price,
          discountedPrice: context.price - Math.floor(context.price * terms.percent / 100), approvalStatus: "approved", status,
          approvedBy: this.actor(user), approvedAt: now, discountId, discountCode: code, updatedAt: now },
        $push: { history: this.history("approved", user, { ...terms, discountId }) },
      }, { session, returnDocument: "after" });
    });
  }
  async reject(id, payload, user) {
    if (!String(payload.reason || "").trim()) throw new ApiError(400, "Cần nhập lý do từ chối");
    return this.mutate(id, user, async (proposal, session) => {
      if (proposal.status !== "pending") throw new ApiError(409, "Đề xuất đã được xử lý");
      return this.Proposal.findOneAndUpdate({ _id: proposal._id, status: "pending" }, {
        $set: { status: "rejected", approvalStatus: "rejected", open: false, rejectedBy: this.actor(user),
          rejectionReason: String(payload.reason).trim().slice(0, 2000), updatedAt: new Date() },
        $push: { history: this.history("rejected", user, { reason: String(payload.reason).trim().slice(0, 2000) }) },
      }, { session, returnDocument: "after" });
    });
  }
  async cancel(id, user) {
    return this.mutate(id, user, async (proposal, session) => {
      if (!proposal.open) throw new ApiError(409, "Đề xuất đã kết thúc");
      if (proposal.discountId) await this.Discount.updateOne({ _id: proposal.discountId }, { $set: { status: "inactive", updatedAt: new Date() } }, { session });
      return this.Proposal.findOneAndUpdate({ _id: proposal._id }, {
        $set: { status: "cancelled", open: false, updatedAt: new Date() }, $push: { history: this.history("cancelled", user) },
      }, { session, returnDocument: "after" });
    });
  }
  async syncLifecycle(now = new Date(), batchId = null) {
    for await (const row of this.Proposal.find({ open: true, ...(batchId ? { batchId: toObjectId(batchId) } : {}) })) {
      await this.mutate(row._id, null, async (proposal, session) => {
        const batch = await this.Batch.findOne({ _id: proposal.batchId }, { session });
        const discount = proposal.discountId ? await this.Discount.findOne({ _id: proposal.discountId }, { session }) : null;
        const invalid = !isBatchSellable(batch, now) || new Date(proposal.endDate) <= now ||
          (discount && (discount.status !== "active" || discount.usedQuantity >= discount.batchQuantity));
        if (invalid) {
          if (discount) await this.Discount.updateOne({ _id: discount._id }, { $set: { status: "inactive", updatedAt: now } }, { session });
          await this.Proposal.updateOne({ _id: proposal._id, open: true }, {
            $set: { open: false, status: "expired", updatedAt: now },
            $push: { history: this.history("expired", null, { calendarDate: calendarDate(now) }) },
          }, { session });
        } else if (proposal.status === "approved" && new Date(proposal.startDate) <= now) {
          await this.Proposal.updateOne({ _id: proposal._id, status: "approved" }, { $set: { status: "active", updatedAt: now } }, { session });
        }
      });
    }
  }
  async list(query = {}) {
    await this.syncLifecycle();
    const page = Number(query.page || 1), limit = Number(query.limit || 12);
    const match = query.status ? { status: query.status } : {};
    const pipeline = [{ $match: match },
      { $lookup: { from: "inventory_batches", localField: "batchId", foreignField: "_id", as: "batch" } },
      { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "product" } },
      { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "creator" } },
      { $set: { batch: { $arrayElemAt: ["$batch", 0] }, product: { $arrayElemAt: ["$product", 0] }, creatorName: { $arrayElemAt: ["$creator.name", 0] } } },
      { $unset: "creator" },
      { $facet: { data: [{ $sort: { createdAt: -1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: "total" }] } }];
    const [result] = await this.Proposal.aggregate(pipeline).toArray();
    return { data: result.data, total: result.count[0]?.total || 0, page, limit };
  }
}
module.exports = PromotionProposalService;
