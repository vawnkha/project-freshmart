const ResourceDeletionService = require("./resource-deletion.service");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const DiscountRepository = require("../repositories/discount.repository");
const validator = require("../validators/discount.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function clean(data) {
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined || (data[key] === "" && key !== "description")) delete data[key];
  });
  return data;
}

function toObjectId(value) {
  if (value instanceof ObjectId) return value;
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function normalizeIdList(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.reduce((result, value) => {
    const objectId = toObjectId(value);
    if (!objectId) return result;
    const key = String(objectId);
    if (seen.has(key)) return result;
    seen.add(key);
    result.push(objectId);
    return result;
  }, []);
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function lineTotal(item = {}) {
  const explicit = Number(item.totalPrice ?? item.subtotal);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  return Number(item.price || 0) * Number(item.quantity || 1);
}

class DiscountService {
  constructor(client) {
    this.client = client;
    this.Batch = client.db().collection("inventory_batches");
    this.Proposal = client.db().collection("promotion_proposals");
    this.Product = client.db().collection("products");
    this.deletion = new ResourceDeletionService(client);
    this.repository = new DiscountRepository(client);
  }

  getPayloadItems(payload = {}) {
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.cartItems)) return payload.cartItems;
    return [];
  }

  async normalizeValidatePayload(payload = {}, { session, discount } = {}) {
    const items = this.getPayloadItems(payload);
    if (!items.length) {
      return { code: payload.code, items: [], subtotal: 0, orderTotal: 0 };
    }

    const productIds = items
      .map((item) => toObjectId(item.productId || item.product_id || item._id))
      .filter(Boolean);

    const products = productIds.length
      ? await this.Product.find(
          { _id: { $in: productIds } },
          { session },
        ).toArray()
      : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const grouped = new Map();
    for (const item of items) {
      const key = String(item.productId || item.product_id || item._id || "");
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || !productMap.has(key)) throw new ApiError(400, "Sản phẩm hoặc số lượng không hợp lệ");
      const totalQuantity = quantity + (grouped.get(key)?.quantity || 0);
      if (!Number.isSafeInteger(totalQuantity)) throw new ApiError(400, "Số lượng không hợp lệ");
      grouped.set(key, { productId: key, quantity: totalQuantity });
    }
    const normalizedItems = [];
    for (const item of grouped.values()) {
      const productId = item.productId || item.product_id || item._id || "";
      const product = productMap.get(String(productId)) || {};
      const categoryId = product.categoryId || product.category_id || "";
      const price = product.sellingPrice !== undefined
            ? product.sellingPrice
            : product.price;
      if (!Number.isFinite(Number(price)) || Number(price) < 0) throw new ApiError(409, "Sản phẩm chưa có giá hợp lệ");
      let batchAllocations = [];
      if (discount?.scope === "batch" && product.inventoryItemId) {
        const allocation = await new (require("./inventory.service"))(this.client).allocateFefo(product.inventoryItemId, item.quantity,
          { session, preferredBatchId: discount.batchId });
        if (!allocation.ok) throw new ApiError(409, "Không đủ hàng khả dụng");
        batchAllocations = allocation.allocation;
      }
      normalizedItems.push({
        productId,
        product_id: productId,
        categoryId,
        category_id: categoryId,
        price: Number(price), quantity: item.quantity, totalPrice: Number(price) * item.quantity, batchAllocations,
      });
    }
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    return { items: normalizedItems, subtotal, orderTotal: subtotal, code: payload.code };
  }

  extractApplicable(payload = {}) {
    const applicable = payload.applicable || {};
    return {
      productIds: normalizeIdList(applicable.productIds || payload.productIds),
      categoryIds: normalizeIdList(applicable.categoryIds || payload.categoryIds),
    };
  }

  extractData(payload = {}, includeCreatedAt = false) {
    const now = new Date();
    const data = clean({
      code: hasValue(payload.code) ? normalizeCode(payload.code) : undefined,
      name: hasValue(payload.name) ? String(payload.name).trim() : undefined,
      description:
        payload.description !== undefined
          ? String(payload.description || "").trim()
          : undefined,
      isPublic:
        payload.isPublic !== undefined
          ? payload.isPublic
          : includeCreatedAt
            ? false
            : undefined,
      scope: hasValue(payload.scope) ? String(payload.scope).trim() : undefined,
      type: hasValue(payload.type) ? String(payload.type).trim() : undefined,
      value: payload.value !== undefined ? Number(payload.value || 0) : undefined,
      minOrderValue:
        payload.minOrderValue !== undefined
          ? Number(payload.minOrderValue || 0)
          : undefined,
      maxDiscountAmount:
        payload.maxDiscountAmount !== undefined
          ? Number(payload.maxDiscountAmount || 0)
          : undefined,
      quantity:
        payload.quantity !== undefined ? Number(payload.quantity || 0) : undefined,
      usedCount:
        payload.usedCount !== undefined ? Number(payload.usedCount || 0) : undefined,
      startDate: payload.startDate !== undefined
        ? (payload.startDate ? new Date(payload.startDate) : null)
        : undefined,
      endDate: payload.endDate !== undefined
        ? (payload.endDate ? new Date(payload.endDate) : null)
        : undefined,
      status:
        payload.status !== undefined
          ? String(payload.status).trim()
          : includeCreatedAt
            ? "active"
            : undefined,
      createdAt: includeCreatedAt ? now : undefined,
      updatedAt: now,
    });

    if (payload.applicable !== undefined || payload.productIds || payload.categoryIds) {
      data.applicable = this.extractApplicable(payload);
    } else if (includeCreatedAt) {
      data.applicable = { productIds: [], categoryIds: [] };
    }

    if (includeCreatedAt && data.usedCount === undefined) data.usedCount = 0;
    if (includeCreatedAt && data.quantity === undefined) data.quantity = 0;
    if (includeCreatedAt && data.minOrderValue === undefined) data.minOrderValue = 0;
    if (includeCreatedAt && data.maxDiscountAmount === undefined) {
      data.maxDiscountAmount = 0;
    }

    return data;
  }

  buildFilter(query = {}) {
    const filter = {};
    if (query.status) filter.status = String(query.status);
    if (query.scope) filter.scope = String(query.scope);
    if (query.type) filter.type = String(query.type);

    if (query.keyword) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { code: { $regex: keyword, $options: "i" } },
        { name: { $regex: keyword, $options: "i" } },
      ];
    }

    return filter;
  }

  async ensureUniqueCode(data, currentId = null) {
    if (!data.code) return;
    const existed = await this.repository.findByCode(data.code);
    if (existed && (!currentId || String(existed._id) !== String(currentId))) {
      throw new ApiError(400, "code da ton tai");
    }
  }

  find(query = {}) {
    return this.repository.findList(this.buildFilter(query), {
      sort: { createdAt: -1 },
    });
  }

  findById(id) {
    return this.repository.findById(id);
  }

  // Public display is opt-in. Legacy/private codes and internal usage/rules stay private.
  async findPublic(now = new Date()) {
    const filter = {
      isPublic: true,
      status: "active",
      scope: { $in: ["order", "product", "category"] },
      type: { $in: validator.TYPES },
      value: { $gt: 0 },
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        },
        { $or: [{ type: "fixed" }, { type: "percent", value: { $lte: 100 } }] },
        {
          $expr: {
            $or: [
              { $eq: [{ $ifNull: ["$quantity", 0] }, 0] },
              {
                $and: [
                  { $gt: ["$quantity", 0] },
                  { $lt: [{ $ifNull: ["$usedCount", 0] }, "$quantity"] },
                ],
              },
            ],
          },
        },
      ],
    };
    const regular = await this.repository.findList(filter, {
      projection: {
        _id: 1, code: 1, name: 1, description: 1, scope: 1, type: 1, value: 1,
        minOrderValue: 1, maxDiscountAmount: 1, startDate: 1, endDate: 1,
      },
      sort: { createdAt: -1 },
      limit: 12,
    });
    return [...regular, ...await this.publicBatchOffers(now)];
  }

  async create(payload = {}) {
    if (payload.scope === "batch") throw new ApiError(400, "Khuyến mãi theo lô phải được tạo từ đề xuất đã phê duyệt");
    const message = validator.validateCreate(payload);
    if (message) throw new ApiError(400, message);

    const data = this.extractData(payload, true);
    await this.ensureUniqueCode(data);
    return this.deletion.withReferences(this.deletion.referencesFor("discounts", data),
      (session) => this.repository.create(data, { session }));
  }

  async update(id, payload = {}) {
    const message = validator.validateUpdate(payload);
    if (message) throw new ApiError(400, message);

    const current = await this.repository.findById(id);
    if (!current) return null;
    if (current.scope === "batch" || payload.scope === "batch") throw new ApiError(409, "Hãy quản lý khuyến mãi theo lô tại Đề xuất giảm giá");

    const data = this.extractData(payload, false);
    await this.ensureUniqueCode(data, current._id);
    return this.deletion.withReferences(this.deletion.referencesFor("discounts", data),
      (session) => this.repository.updateById(id, data, { session }));
  }

  async remove(id) {
    const current = await this.repository.findById(id);
    if (current?.scope === "batch") throw new ApiError(409, "Hãy hủy đề xuất để giữ lịch sử khuyến mãi theo lô");
    return this.deletion.remove("discounts", id);
  }

  getOrderTotal(payload = {}) {
    const total = Number(
      payload.orderTotal ?? payload.subtotal ?? payload.total ?? payload.totalPrice,
    );
    if (Number.isFinite(total) && total >= 0) return total;

    const items = this.getPayloadItems(payload);
    return items.reduce((sum, item) => sum + lineTotal(item), 0);
  }

  getDiscountBase(discount, payload = {}) {
    const orderTotal = this.getOrderTotal(payload);
    const items = this.getPayloadItems(payload);
    const applicable = discount.applicable || {};
    const productIds = new Set((applicable.productIds || []).map(String));
    const categoryIds = new Set((applicable.categoryIds || []).map(String));

    if (discount.scope === "order") {
      return orderTotal;
    }

    if (!items.length) return 0;

    return items.reduce((sum, item) => {
      const productId = String(item.productId || item.product_id || "");
      const categoryId = String(item.categoryId || item.category_id || "");

      const matchProduct =
        discount.scope === "product" &&
        (!productIds.size || productIds.has(productId));
      const matchCategory =
        discount.scope === "category" &&
        (!categoryIds.size || categoryIds.has(categoryId));

      return matchProduct || matchCategory ? sum + lineTotal(item) : sum;
    }, 0);
  }

  calculateDiscountAmount(discount, baseAmount) {
    if (baseAmount <= 0) return 0;

    let amount =
      discount.type === "percent"
        ? (baseAmount * Number(discount.value || 0)) / 100
        : Number(discount.value || 0);

    const maxDiscountAmount = Number(discount.maxDiscountAmount || 0);
    if (maxDiscountAmount > 0) amount = Math.min(amount, maxDiscountAmount);

    return Math.max(0, Math.min(baseAmount, Math.floor(amount)));
  }

  inactiveResult(message) {
    return { valid: false, message, discountAmount: 0 };
  }

  async getBatchOffer(discount, { session, now = new Date() } = {}) {
    const { isBatchSellable, classifyExpiry } = require("../utils/expiry.util");
    if (discount?.scope !== "batch" || discount.status !== "active" || new Date(discount.startDate) > now || new Date(discount.endDate) <= now
      || !(discount.value > 0 && discount.value <= require("../config/expiry").maxDiscount)) return null;
    const batch = await this.Batch.findOne({ _id: discount.batchId }, { session });
    if (!isBatchSellable(batch, now)) return null;
    const proposal = await this.Proposal.findOne({ _id: discount.proposalId, discountId: discount._id, approvalStatus: "approved", open: true }, { session });
    if (!proposal) return null;
    const product = await this.Product.findOne({ _id: proposal.productId, inventoryItemId: batch.inventoryItemId, status: "active" }, { session });
    const item = await this.client.db().collection("inventory_items").findOne({ _id: batch.inventoryItemId }, { session });
    if (!product || !item || (item.status && item.status !== "active")) return null;
    const availableQuantity = Math.min(batch.quantity, Number(discount.batchQuantity || 0) - Number(discount.usedQuantity || 0));
    if (!(availableQuantity > 0)) return null;
    const originalPrice = Number(product.sellingPrice ?? product.price);
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) return null;
    return { _id: discount._id, code: discount.code, name: discount.name, scope: "batch", type: "percent", value: discount.value,
      batchId: batch._id, batchNumber: batch.batchNumber, productId: product._id, productName: product.name, expiryDate: batch.expiryDate,
      ...classifyExpiry(batch.expiryDate, now), availableQuantity, originalPrice,
      discountedPrice: originalPrice - Math.floor(originalPrice * discount.value / 100), startDate: discount.startDate, endDate: discount.endDate,
      description: "Nhập mã tại thanh toán. Chỉ giảm trên số lượng được phân bổ từ lô này; không cộng dồn mã khác." };
  }
  async publicBatchOffers(now = new Date()) {
    const offers = [];
    for await (const discount of this.repository.collection().find({ scope: "batch", isPublic: true, status: "active", startDate: { $lte: now }, endDate: { $gt: now } })) {
      const offer = await this.getBatchOffer(discount, { now });
      if (offer) offers.push(offer);
    }
    return offers;
  }
  async validateDiscount(payload = {}, options = {}) {
    const message = validator.validateValidatePayload(payload);
    if (message) throw new ApiError(400, message);

    const code = normalizeCode(payload.code);
    const discount = await this.repository.collection().findOne({ code }, { session: options.session });
    if (!discount) return this.inactiveResult("Ma giam gia khong ton tai");
    const now = new Date();
    if (discount.status !== "active") {
      return this.inactiveResult("Ma giam gia khong hoat dong");
    }

    if (discount.startDate && new Date(discount.startDate) > now) {
      return this.inactiveResult("Ma giam gia chua den ngay ap dung");
    }

    if (discount.endDate && new Date(discount.endDate) < now) {
      return this.inactiveResult("Ma giam gia da het han");
    }

    const quantity = Number(discount.quantity || 0);
    if (quantity > 0 && Number(discount.usedCount || 0) >= quantity) {
      return this.inactiveResult("Ma giam gia da het luot su dung");
    }

    let batchOffer = null, eligibleQuantity = 0, batchBreakdown = [];
    if (discount.scope === "batch") {
      batchOffer = await this.getBatchOffer(discount, options);
      if (!batchOffer) return this.inactiveResult("Lô khuyến mãi đã hết hạn, hết hàng, bị hủy hoặc hết số lượng ưu đãi");
    }
    const normalizedPayload = options.trustedItems ? payload : await this.normalizeValidatePayload(payload, { ...options, discount });

    const orderTotal = this.getOrderTotal(normalizedPayload);
    if (orderTotal < Number(discount.minOrderValue || 0)) {
      return this.inactiveResult("Don hang chua dat gia tri toi thieu");
    }

    let baseAmount;
    if (discount.scope === "batch") {
      let remaining = batchOffer.availableQuantity;
      baseAmount = 0;
      for (const item of this.getPayloadItems(normalizedPayload)) {
        if (String(item.productId || item.product_id) !== String(batchOffer.productId)) continue;
        for (const row of item.batchAllocations || []) {
          if (String(row.batchId) !== String(discount.batchId)) continue;
          const quantity = Math.min(Number(row.quantity), remaining);
          if (quantity <= 0) continue;
          const amount = Number(item.price) * quantity;
          baseAmount += amount; eligibleQuantity += quantity; remaining -= quantity;
          batchBreakdown.push({ productId: batchOffer.productId, batchId: row.batchId, quantity, baseAmount: amount,
            expiryDate: row.expiryDate, batchNumber: row.batchNumber });
        }
      }
    } else baseAmount = this.getDiscountBase(discount, normalizedPayload);
    if (baseAmount <= 0) {
      return this.inactiveResult("Ma giam gia khong ap dung cho don hang nay");
    }

    const discountAmount = this.calculateDiscountAmount(discount, baseAmount);
    const finalTotal = Math.max(0, orderTotal - discountAmount);

    return {
      valid: true,
      message: "Ma giam gia hop le",
      discount: {
        _id: discount._id,
        code: discount.code,
        name: discount.name,
        scope: discount.scope,
        type: discount.type,
        value: discount.value,
        ...(batchOffer ? { batchId: discount.batchId, eligibleQuantity } : {}),
      },
      ...(batchOffer ? { batchOffer, batchBreakdown } : {}),
      baseAmount,
      orderTotal,
      discountAmount,
      finalTotal,
      finalAmount: finalTotal,
    };
  }
}

module.exports = DiscountService;
