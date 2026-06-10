const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const DiscountRepository = require("../repositories/discount.repository");
const validator = require("../validators/discount.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function clean(data) {
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined || data[key] === "") delete data[key];
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
    this.Product = client.db().collection("products");
    this.repository = new DiscountRepository(client);
  }

  getPayloadItems(payload = {}) {
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.cartItems)) return payload.cartItems;
    return [];
  }

  async normalizeValidatePayload(payload = {}) {
    const items = this.getPayloadItems(payload);
    if (!items.length) {
      return { ...payload, items: [] };
    }

    const productIds = items
      .map((item) => toObjectId(item.productId || item.product_id || item._id))
      .filter(Boolean);

    const products = productIds.length
      ? await this.Product.find(
          { _id: { $in: productIds } },
          {
            projection: {
              category_id: 1,
              categoryId: 1,
              price: 1,
              sellingPrice: 1,
            },
          },
        ).toArray()
      : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const normalizedItems = items.map((item) => {
      const productId = item.productId || item.product_id || item._id || "";
      const product = productMap.get(String(productId)) || {};
      const categoryId =
        item.categoryId ||
        item.category_id ||
        product.categoryId ||
        product.category_id ||
        "";
      const price =
        item.price !== undefined
          ? item.price
          : product.sellingPrice !== undefined
            ? product.sellingPrice
            : product.price;

      return {
        ...item,
        productId,
        product_id: item.product_id || productId,
        categoryId,
        category_id: item.category_id || categoryId,
        price,
      };
    });

    return { ...payload, items: normalizedItems };
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
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
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

  async create(payload = {}) {
    const message = validator.validateCreate(payload);
    if (message) throw new ApiError(400, message);

    const data = this.extractData(payload, true);
    await this.ensureUniqueCode(data);
    return this.repository.create(data);
  }

  async update(id, payload = {}) {
    const message = validator.validateUpdate(payload);
    if (message) throw new ApiError(400, message);

    const current = await this.repository.findById(id);
    if (!current) return null;

    const data = this.extractData(payload, false);
    await this.ensureUniqueCode(data, current._id);
    return this.repository.updateById(id, data);
  }

  remove(id) {
    return this.repository.updateById(id, {
      status: "inactive",
      updatedAt: new Date(),
    });
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

  async validateDiscount(payload = {}) {
    const message = validator.validateValidatePayload(payload);
    if (message) throw new ApiError(400, message);

    const normalizedPayload = await this.normalizeValidatePayload(payload);
    const code = normalizeCode(normalizedPayload.code);
    const discount = await this.repository.findByCode(code);
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

    const orderTotal = this.getOrderTotal(normalizedPayload);
    if (orderTotal < Number(discount.minOrderValue || 0)) {
      return this.inactiveResult("Don hang chua dat gia tri toi thieu");
    }

    const baseAmount = this.getDiscountBase(discount, normalizedPayload);
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
      },
      baseAmount,
      orderTotal,
      discountAmount,
      finalTotal,
      finalAmount: finalTotal,
    };
  }
}

module.exports = DiscountService;
