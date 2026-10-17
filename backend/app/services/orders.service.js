const { ObjectId } = require("mongodb");
const InventoryService = require("./inventory.service");
const DiscountService = require("./discount.service");
const ApiError = require("../api-error");
const { paypalRefundCapture } = require("../utils/paypal.util");
const {
  assertOrderTransition,
  normalizeOrderStatus,
} = require("../utils/order-state.util");
const { hasPermission } = require("../config/permissions");
const OutboxService = require("./outbox.service");
const PAYMENT_METHODS = require("../constants/payment-methods");
const { isInventoryItemActive } = require("../utils/inventory-query.util");
const { checkoutFingerprint } = require("../utils/checkout-fingerprint.util");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function getProductPrice(product = {}) {
  if (product.sellingPrice !== undefined)
    return Number(product.sellingPrice || 0);
  return Number(product.price || 0);
}

function getProductImage(product = {}) {
  if (product.thumbnail) return product.thumbnail;
  if (Array.isArray(product.images) && product.images[0])
    return product.images[0];
  return "";
}

class OrdersService {
  constructor(client) {
    const ResourceDeletionService = require("./resource-deletion.service");
    this.deletion = new ResourceDeletionService(client);
    const db = client.db();
    this.client = client;
    this.Order = db.collection("orders");
    this.Cart = db.collection("carts");
    this.Product = db.collection("products");
    this.Address = db.collection("addresses");
    this.Payment = db.collection("payments");
    this.PaymentIntent = db.collection("payment_intents");
    this.ShippingMethod = db.collection("shipping_methods");
    this.Discount = db.collection("discounts");
    this.UserDiscount = db.collection("user_discounts");
    this.InventoryItem = db.collection("inventory_items");
    this.inventoryService = new InventoryService(client);
    this.discountService = new DiscountService(client);
    this.outbox = new OutboxService(client);
  }

  timelineItem(status, note = "") {
    return { status, changed_at: new Date(), note };
  }

  buildOrderNotification(order, payment = {}) {
    return {
      type: "order",
      title: "Có đơn hàng mới",
      content: `Có đơn đặt hàng mới với mã ${order._id}`,
      data: {
        order_id: String(order._id),
        user_id: String(order.user_id),
        total_price: order.total_price,
        status: order.status,
        payment_method: payment.method || PAYMENT_METHODS.COD,
        payment_status: payment.status || "pending",
      },
    };
  }

  mapStatusText(status) {
    switch ((status || "").toLowerCase()) {
      case "pending":
        return "Chờ xác nhận";
      case "processing":
        return "Đang xử lý";
      case "shipping":
        return "Đang giao";
      case "completed":
        return "Hoàn thành";
      case "canceled":
        return "Đã hủy";
      default:
        return status || "";
    }
  }

  mapPaymentMethod(method) {
    if (!method) return PAYMENT_METHODS.COD;
    return method === "cash" ? PAYMENT_METHODS.COD : method;
  }

  normalizeOrderItem(item = {}) {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const subtotal = Number(
      item.subtotal || item.totalPrice || price * quantity,
    );

    return {
      product_id: item.product_id,
      productId: item.productId || item.product_id,
      category_id: item.category_id || item.categoryId,
      categoryId: item.categoryId || item.category_id,
      inventoryItemId: item.inventoryItemId,
      name: item.name,
      productName: item.productName || item.name,
      slug: item.slug,
      quantity,
      price,
      thumbnail: item.thumbnail || item.image || "",
      image: item.image || item.thumbnail || "",
      subtotal,
      totalPrice: Number(item.totalPrice || subtotal),
      itemCode: item.itemCode,
      itemName: item.itemName,
      unit: item.unit,
      packageSize: item.packageSize,
      batchAllocations: item.batchAllocations || [],
    };
  }

  normalizeOrder(doc) {
    const address = doc.shipping_address_snapshot || doc.address;
    return {
      _id: doc._id,
      user_id: doc.user_id,
      invoice_sent: doc.invoice_sent || false,
      invoice_sent_at: doc.invoice_sent_at || null,
      invoice_queued_at: doc.invoice_queued_at || null,
      invoice_status: doc.invoice_sent ? "sent" : doc.invoice_event?.status === "processing"
        ? "processing" : doc.invoice_event?.lastError ? "failed"
        : doc.invoice_outbox_id ? "queued" : null,
      user: doc.user
        ? {
            _id: doc.user._id,
            name: doc.user.name || "",
            email: doc.user.email || "",
          }
        : null,

      status: doc.status,
      status_text: this.mapStatusText(doc.status),

      payment_method: this.mapPaymentMethod(doc.payment?.method),
      payment_status: doc.payment?.status || "pending",

      subtotal_price: Number(doc.subtotal_price || doc.total_price || 0),
      shipping_fee: Number(doc.shipping_fee || 0),
      shipping_method_id: doc.shipping_method_id || null,
      shipping_method: doc.shipping_method || null,
      shipping: doc.shipping || null,
      discount: doc.discount || null,
      discount_amount: Number(
        doc.discount_amount || doc.pricing?.discount_amount || 0,
      ),
      pricing: doc.pricing || {
        subtotal: Number(doc.subtotal_price || doc.total_price || 0),
        shipping_fee: Number(doc.shipping_fee || 0),
        discount_amount: Number(doc.discount_amount || 0),
        total: Number(doc.total_price || 0),
      },
      total_price: Number(doc.total_price || 0),

      created_at: doc.created_at,

      items: (doc.items || []).map((item) => this.normalizeOrderItem(item)),

      shipping_address: address
        ? {
            _id: address._id,
            fullName:
              address.fullName ||
              address.full_name ||
              address.name ||
              "",
            address: address.address_line || "",
            city: address.city || "",
            phone: address.phone || "",
            email: address.email || "",
          }
        : null,

      timeline: doc.timeline || [],
    };
  }

  isLegacyCompatibleStatus(product) {
    if (!product.status) return true;
    return ["active", "in_stock"].includes(product.status);
  }

  async resolveShippingMethod(shippingMethodId) {
    const sid = toObjectId(shippingMethodId);
    if (!sid) return { error: "shippingMethodId khong hop le" };

    const method = await this.ShippingMethod.findOne({
      _id: sid,
      status: "active",
    });

    if (!method) {
      return { error: "Phuong thuc van chuyen khong hop le hoac da ngung" };
    }

    return {
      method,
      snapshot: {
        _id: method._id,
        name: method.name || "",
        code: method.code || "",
        fee: Number(method.fee || 0),
        estimatedDays: Number(method.estimatedDays || 0),
      },
    };
  }

  buildDiscountCartItems(items = []) {
    return items.map((item) => ({
      productId: item.productId || item.product_id,
      product_id: item.product_id || item.productId,
      categoryId: item.categoryId || item.category_id,
      category_id: item.category_id || item.categoryId,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal || item.totalPrice,
      totalPrice: item.totalPrice || item.subtotal,
    }));
  }

  buildDiscountSnapshot(validationResult) {
    if (!validationResult?.valid || !validationResult.discount) return null;
    const discount = validationResult.discount;
    return {
      discount_id: discount._id,
      code: discount.code,
      name: discount.name || "",
      scope: discount.scope,
      type: discount.type,
      value: Number(discount.value || 0),
      discount_amount: Number(validationResult.discountAmount || 0),
    };
  }

  async resolveDiscount({ discountCode, subtotal, items }) {
    if (!discountCode || !String(discountCode).trim()) {
      return {
        discount: null,
        discount_amount: 0,
        validation: null,
      };
    }

    const validation = await this.discountService.validateDiscount({
      code: discountCode,
      subtotal,
      cartItems: this.buildDiscountCartItems(items),
    });

    if (!validation.valid) {
      return { error: validation.message || "Ma giam gia khong hop le" };
    }

    return {
      discount: this.buildDiscountSnapshot(validation),
      discount_amount: Number(validation.discountAmount || 0),
      validation,
    };
  }

  async recordDiscountUsage(discount, userId, orderId, session) {
    if (!discount?.discount_id) return;

    const discountId = toObjectId(discount.discount_id);
    if (!discountId) {
      throw new Error("Ma giam gia khong hop le");
    }

    const usageResult = await this.Discount.updateOne(
      {
        _id: discountId,
        status: "active",
        $or: [
          { quantity: { $exists: false } },
          { quantity: { $lte: 0 } },
          {
            $expr: {
              $lt: [
                { $ifNull: ["$usedCount", 0] },
                { $ifNull: ["$quantity", 0] },
              ],
            },
          },
        ],
      },
      {
        $inc: { usedCount: 1 },
        $set: { updatedAt: new Date() },
      },
      { session },
    );

    if (usageResult.modifiedCount !== 1) {
      throw new Error("Ma giam gia da het luot su dung");
    }

    await this.UserDiscount.insertOne(
      {
        userId,
        discountId,
        orderId,
        code: discount.code,
        usedAt: new Date(),
      },
      { session },
    );
  }

  async findAll() {
    const docs = await this.Order.aggregate([
      {
        $lookup: {
          from: "addresses",
          localField: "address_id",
          foreignField: "_id",
          as: "address",
        },
      },
      { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "payments",
          localField: "_id",
          foreignField: "order_id",
          as: "payment",
        },
      },
      { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },

      { $sort: { created_at: -1 } },
    ]).toArray();

    return docs.map((doc) => this.normalizeOrder(doc));
  }

  async findByUser(userId) {
    const uid = toObjectId(userId);
    if (!uid) return [];

    const docs = await this.Order.aggregate([
      { $match: { user_id: uid } },

      {
        $lookup: {
          from: "addresses",
          localField: "address_id",
          foreignField: "_id",
          as: "address",
        },
      },
      { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "payments",
          localField: "_id",
          foreignField: "order_id",
          as: "payment",
        },
      },
      { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },

      { $sort: { created_at: -1 } },
    ]).toArray();

    return docs.map((doc) => this.normalizeOrder(doc));
  }

  async clearUserCart(userId, options = {}) {
    await this.Cart.updateOne(
      { user_id: userId },
      { $set: { items: [], updated_at: new Date() } },
      { session: options.session },
    );
  }

  async buildCheckoutPlan({
    userId,
    addressId,
    shippingMethodId = null,
    discountCode = "",
    allocateBatches = true,
    session,
  }) {
    const uid = toObjectId(userId);
    const aid = toObjectId(addressId);

    if (!uid || !aid) {
      return { error: "userId và addressId không hợp lệ" };
    }

    const cart = await this.Cart.findOne({ user_id: uid }, { session });
    if (!cart || !cart.items?.length) {
      return { error: "Giỏ hàng trống" };
    }

    const address = await this.Address.findOne(
      { _id: aid, user_id: uid },
      { session },
    );
    if (!address) {
      return { error: "Địa chỉ giao hàng không hợp lệ" };
    }

    const cartItemMap = new Map();
    for (const item of cart.items) {
      const quantity = Number(item.quantity);
      if (
        !toObjectId(item.product_id) ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        return { error: "San pham hoac so luong trong gio hang khong hop le" };
      }
      const key = String(item.product_id);
      const totalQuantity = (cartItemMap.get(key)?.quantity || 0) + quantity;
      if (!Number.isSafeInteger(totalQuantity))
        return { error: "So luong khong hop le" };
      cartItemMap.set(key, {
        product_id: item.product_id,
        quantity: totalQuantity,
      });
    }
    const cartItems = [...cartItemMap.values()];
    const ids = cartItems
      .map((item) => toObjectId(item.product_id))
      .filter(Boolean);
    const products = await this.Product.find(
      { _id: { $in: ids } },
      { session },
    ).toArray();
    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );

    let total = 0;
    const orderItems = [];

    for (const cartItem of cartItems) {
      const product = productMap.get(String(cartItem.product_id));
      if (!product)
        return { error: "San pham trong gio hang khong con ton tai" };
      if (session) {
        // Synchronize with product edits/disable, including concurrent legacy sales.
        await this.Product.updateOne(
          { _id: product._id },
          { $inc: { stockVersion: 1 } },
          { session },
        );
      }

      const qty = cartItem.quantity;
      const price = getProductPrice(product);
      const inventoryItemId = toObjectId(product.inventoryItemId);
      if (product.inventoryItemId && !inventoryItemId)
        return { error: "Lien ket hang kho khong hop le" };

      if (inventoryItemId) {
        if (product.status !== "active") {
          return { error: `Sản phẩm "${product.name}" chưa được kích hoạt` };
        }

        if (session)
          await this.inventoryService.stockService.acquireItem(
            inventoryItemId,
            session,
            { requireActive: true },
          );
        const inventoryItem = await this.InventoryItem.findOne(
          {
            _id: inventoryItemId,
          },
          { session },
        );
        if (!isInventoryItemActive(inventoryItem)) {
          return { error: `Hàng kho của "${product.name}" không hoạt động` };
        }

        const stock =
          await this.inventoryService.stockService.getAvailableStock(
            inventoryItemId,
            { session },
          );
        if (stock < qty) {
          return { error: `Sản phẩm "${product.name}" không đủ tồn kho` };
        }

        const allocationResult = allocateBatches
          ? await this.inventoryService.allocateFefo(inventoryItemId, qty, {
              session,
            })
          : { ok: true, allocation: [] };

        if (!allocationResult.ok) {
          return {
            error:
              allocationResult.error ||
              `Sản phẩm "${product.name}" không đủ lô hàng khả dụng`,
          };
        }

        const totalPrice = price * qty;
        total += totalPrice;

        orderItems.push({
          product_id: product._id,
          productId: product._id,
          category_id: product.category_id || product.categoryId,
          categoryId: product.categoryId || product.category_id,
          inventoryItemId,
          name: product.name,
          productName: product.name,
          slug: product.slug,
          thumbnail: getProductImage(product),
          image: getProductImage(product),
          itemCode: inventoryItem.itemCode,
          itemName: inventoryItem.itemName,
          unit: inventoryItem.unit || product.unit,
          packageSize: inventoryItem.packageSize || "",
          quantity: qty,
          price,
          subtotal: totalPrice,
          totalPrice,
          batchAllocations: (allocationResult.allocation || []).map((row) => ({
            batchId: row.batchId,
            batchNumber: row.batchNumber,
            quantity: Number(row.quantity || 0),
            expiryDate: row.expiryDate || null,
            importPrice: Number(row.importPrice || 0),
            inventoryItemId,
          })),
        });

        continue;
      }

      if (!this.isLegacyCompatibleStatus(product)) {
        return { error: `Sản phẩm "${product.name}" chưa được kích hoạt` };
      }

      if (Number(product.stock || 0) < qty) {
        return { error: `Sản phẩm "${product.name}" không đủ tồn kho` };
      }

      const totalPrice = price * qty;
      total += totalPrice;

      orderItems.push({
        product_id: product._id,
        productId: product._id,
        category_id: product.category_id || product.categoryId,
        categoryId: product.categoryId || product.category_id,
        name: product.name,
        productName: product.name,
        slug: product.slug,
        quantity: qty,
        price,
        thumbnail: getProductImage(product),
        image: getProductImage(product),
        subtotal: totalPrice,
        totalPrice,
      });
    }

    if (!orderItems.length) {
      return { error: "Giỏ hàng không hợp lệ" };
    }

    let shippingMethod = null;
    let shippingSnapshot = null;
    let shippingFee = 0;

    if (shippingMethodId) {
      const shippingResult = await this.resolveShippingMethod(shippingMethodId);
      if (shippingResult.error) return { error: shippingResult.error };
      shippingMethod = shippingResult.method;
      shippingSnapshot = shippingResult.snapshot;
      shippingFee = Number(shippingSnapshot.fee || 0);
    }

    const discountResult = await this.resolveDiscount({
      discountCode,
      subtotal: total,
      items: orderItems,
    });
    if (discountResult.error) return { error: discountResult.error };

    const discountAmount = Number(discountResult.discount_amount || 0);
    const finalTotal = Math.max(0, total + shippingFee - discountAmount);

    return {
      ok: true,
      uid,
      aid,
      cart,
      address,
      items: orderItems,
      subtotal_price: total,
      shippingMethod,
      shipping_method_id: shippingMethod?._id || null,
      shipping_method: shippingSnapshot,
      shipping_fee: shippingFee,
      discount: discountResult.discount,
      discount_amount: discountAmount,
      total_price: finalTotal,
      pricing: {
        subtotal: total,
        shipping_fee: shippingFee,
        discount_amount: discountAmount,
        total: finalTotal,
      },
    };
  }

  async deductCheckoutStock(orderItems, orderId, userId, session) {
    const actor = { _id: userId };

    for (const item of orderItems) {
      if (item.inventoryItemId) {
        if (!item.batchAllocations?.length)
          throw new ApiError(409, "Khong co lo hang kha dung de tru kho");
        await this.inventoryService.exportAllocation(
          item.batchAllocations,
          {
            type: "order",
            id: orderId,
            code: String(orderId),
          },
          actor,
          { session },
        );
        continue;
      }

      const rs = await this.Product.updateOne(
        { _id: item.product_id, stock: { $gte: item.quantity } },
        {
          $inc: { stock: -item.quantity },
          $set: { updated_at: new Date() },
        },
        { session },
      );

      if (rs.modifiedCount !== 1) {
        throw new Error(
          `Không trừ tồn kho cho "${item.name}" (có thể vừa hết hàng)`,
        );
      }
    }
  }

  async createFromCart({
    userId,
    addressId,
    payment_method,
    shippingMethodId,
    discountCode,
    orderStatus,
    paymentStatus,
    transactionId,
    idempotencyKey,
    paymentMetadata,
    expectedCheckoutFingerprint,
    expectedTotalVnd,
    enqueueAdminNotification = false,
  }) {
    if (idempotencyKey) {
      const existingPayment = await this.Payment.findOne({
        idempotency_key: idempotencyKey,
      });
      if (existingPayment) {
        const existingOrder = await this.Order.findOne({
          _id: existingPayment.order_id,
        });
        return {
          ok: true,
          order: existingOrder,
          payment: existingPayment,
          idempotent: true,
        };
      }
    }

    const method = payment_method || PAYMENT_METHODS.COD;
    const initialStatus = orderStatus || "pending";
    const session = this.client.startSession();
    let result = null;

    try {
      await session.withTransaction(
        async () => {
          if (idempotencyKey) {
            const existingPayment = await this.Payment.findOne(
              { idempotency_key: idempotencyKey },
              { session },
            );
            if (existingPayment) {
              const existingOrder = await this.Order.findOne(
                { _id: existingPayment.order_id },
                { session },
              );
              result = {
                ok: true,
                order: existingOrder,
                payment: existingPayment,
                idempotent: true,
              };
              return;
            }
          }

          const plan = await this.buildCheckoutPlan({
            userId,
            addressId,
            shippingMethodId,
            discountCode,
            allocateBatches: true,
            session,
          });
          if (plan?.error) throw new ApiError(409, plan.error);
          if ((expectedCheckoutFingerprint && checkoutFingerprint(plan) !== expectedCheckoutFingerprint)
            || (expectedTotalVnd !== undefined && Number(plan.total_price) !== Number(expectedTotalVnd))) {
            throw new ApiError(409, "Giỏ hàng đã thay đổi, vui lòng tạo lại thanh toán", "CHECKOUT_CHANGED");
          }

          const orderDoc = {
            user_id: plan.uid,
            items: plan.items,
            address_id: plan.aid,
            shipping_address_snapshot: {
              _id: plan.address._id,
              full_name: plan.address.full_name || plan.address.fullName || plan.address.name || "",
              phone: plan.address.phone || "",
              address_line: plan.address.address_line || "",
              city: plan.address.city || "",
              email: plan.address.email || "",
            },
            subtotal_price: plan.subtotal_price,
            shipping_method_id: plan.shipping_method_id,
            shipping_method: plan.shipping_method,
            shipping: plan.shipping_method,
            shipping_fee: plan.shipping_fee,
            discount: plan.discount,
            discount_amount: plan.discount_amount,
            pricing: plan.pricing,
            total_price: plan.total_price,
            status: initialStatus,
            timeline: [this.timelineItem(initialStatus, "Tạo đơn hàng")],
            created_at: new Date(),
          };
          const paymentDoc = {
            order_id: null,
            user_id: plan.uid,
            method,
            transaction_id: transactionId || null,
            idempotency_key: idempotencyKey || null,
            amount: plan.total_price,
            status: paymentStatus || "pending",
            paid_at: null,
            ...(paymentMetadata || {}),
            created_at: new Date(),
            updated_at: new Date(),
          };

          await this.deletion.withReferences(this.deletion.referencesFor("orders", orderDoc), async () => {}, { session });
          const orderRs = await this.Order.insertOne(orderDoc, { session });
          paymentDoc.order_id = orderRs.insertedId;

          const paymentRs = await this.Payment.insertOne(paymentDoc, {
            session,
          });

          await this.deductCheckoutStock(
            plan.items,
            orderRs.insertedId,
            plan.uid,
            session,
          );

          await this.recordDiscountUsage(
            plan.discount,
            plan.uid,
            orderRs.insertedId,
            session,
          );

          await this.clearUserCart(plan.uid, { session });

          if (enqueueAdminNotification) {
            await this.outbox.enqueue(
              "notification.admin",
              this.buildOrderNotification(
                { _id: orderRs.insertedId, ...orderDoc },
                { _id: paymentRs.insertedId, ...paymentDoc },
              ),
              {
                session,
                idempotencyKey: `order-notification:${orderRs.insertedId}`,
              },
            );
          }

          result = {
            ok: true,
            order: { _id: orderRs.insertedId, ...orderDoc },
            payment: { _id: paymentRs.insertedId, ...paymentDoc },
          };
        },
        { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
      );
    } catch (error) {
      if (idempotencyKey && error?.code === 11000) {
        const existingPayment = await this.Payment.findOne({
          idempotency_key: idempotencyKey,
        });
        const existingOrder = existingPayment
          ? await this.Order.findOne({ _id: existingPayment.order_id })
          : null;
        if (existingPayment && existingOrder) {
          return {
            ok: true,
            order: existingOrder,
            payment: existingPayment,
            idempotent: true,
          };
        }
      }
      return { error: error.message || "Không thể tạo đơn hàng" };
    } finally {
      await session.endSession();
    }

    return result;
  }

  findPaymentByIdempotencyKey(idempotencyKey) {
    return this.Payment.findOne({ idempotency_key: idempotencyKey });
  }

  async getOrderDetail(orderId) {
    const oid = toObjectId(orderId);
    if (!oid) return null;

    const [doc] = await this.Order.aggregate([
      { $match: { _id: oid } },

      {
        $lookup: {
          from: "payments",
          localField: "_id",
          foreignField: "order_id",
          as: "payment",
        },
      },
      { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "addresses",
          localField: "address_id",
          foreignField: "_id",
          as: "address",
        },
      },
      { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]).toArray();

    if (!doc) return null;
    if (doc.invoice_outbox_id) {
      doc.invoice_event = await this.client.db().collection("outbox_events").findOne(
        { _id: doc.invoice_outbox_id }, { projection: { status: 1, lastError: 1 } },
      );
    }

    return this.normalizeOrder(doc);
  }

  async pushStatus(orderId, status, note = "") {
    return this.transitionStatus(orderId, status, null, note);
  }

  async transitionStatus(orderId, status, actor = null, note = "") {
    const oid = toObjectId(orderId);
    if (!oid) return null;
    const current = await this.Order.findOne({ _id: oid });
    if (!current) return null;
    const nextStatus = assertOrderTransition(current.status, status);
    if (nextStatus === "canceled") {
      return this.cancelOrder(orderId, actor, note || "Hủy đơn hàng");
    }

    const updated = await this.Order.findOneAndUpdate(
      { _id: oid, status: current.status },
      {
        $set: { status: nextStatus, updated_at: new Date() },
        $push: { timeline: this.timelineItem(nextStatus, note) },
      },
      { returnDocument: "after" },
    );
    if (!updated) throw new ApiError(409, "Trạng thái đơn hàng vừa thay đổi");
    return updated;
  }

  async restoreOrderInventory(order, actor, session) {
    for (const item of order.items || []) {
      if (item.inventoryItemId && item.batchAllocations?.length) {
        await this.inventoryService.restoreAllocation(
          item.batchAllocations,
          {
            type: "order_cancel",
            id: order._id,
            code: String(order._id),
          },
          actor,
          { session },
        );
        continue;
      }

      await this.Product.updateOne(
        { _id: item.product_id },
        {
          $inc: { stock: Number(item.quantity || 0) },
          $set: { updated_at: new Date() },
        },
        { session },
      );
    }
  }

  async cancelOrder(orderId, actor = null, note = "Người dùng hủy đơn hàng") {
    const oid = toObjectId(orderId);
    if (!oid) return null;

    const session = this.client.startSession();
    let updated = null;
    let refundRequest = null;

    try {
      await session.withTransaction(async () => {
        const order = await this.Order.findOne({ _id: oid }, { session });
        if (!order) return;
        const currentStatus = normalizeOrderStatus(order.status);
        if (
          !["pending", "processing", "cancel_pending"].includes(currentStatus)
        ) {
          throw new ApiError(
            409,
            "Đơn hàng không thể hủy ở trạng thái hiện tại",
          );
        }
        if (
          currentStatus === "processing" &&
          !hasPermission(actor || {}, ["order:update"])
        ) {
          throw new ApiError(
            409,
            "Người dùng chỉ có thể hủy đơn đang chờ xác nhận",
          );
        }

        const payment = await this.Payment.findOne(
          { order_id: oid },
          { session },
        );
        if (
          payment?.method === "paypal" &&
          ["completed", "refund_pending"].includes(payment.status)
        ) {
          const captureId = payment.paypal?.capture_id;
          if (!captureId) {
            throw new ApiError(409, "Thiếu PayPal capture ID để hoàn tiền");
          }

          if (currentStatus !== "cancel_pending") {
            await this.Order.updateOne(
              { _id: oid, status: order.status },
              {
                $set: { status: "cancel_pending", updated_at: new Date() },
                $push: {
                  timeline: this.timelineItem(
                    "cancel_pending",
                    "Đang chờ hoàn tiền PayPal",
                  ),
                },
              },
              { session },
            );
            await this.Payment.updateOne(
              { _id: payment._id, status: "completed" },
              { $set: { status: "refund_pending", updated_at: new Date() } },
              { session },
            );
          }
          refundRequest = { captureId, paymentId: payment._id };
          return;
        }

        await this.restoreOrderInventory(order, actor, session);

        updated = await this.Order.findOneAndUpdate(
          { _id: oid, status: order.status },
          {
            $set: {
              status: "canceled",
              inventory_restored_at: new Date(),
            },
            $push: { timeline: this.timelineItem("canceled", note) },
          },
          { returnDocument: "after", session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (!refundRequest) return updated;

    let refund;
    try {
      refund = await paypalRefundCapture(refundRequest.captureId, {
        requestId: `refund-${refundRequest.paymentId}`,
      });
    } catch (_) {
      throw new ApiError(
        502,
        "Yêu cầu hoàn tiền chưa hoàn tất; có thể thử hủy lại an toàn",
      );
    }
    if (refund?.status !== "COMPLETED") {
      return this.Order.findOne({ _id: oid });
    }

    const finalizeSession = this.client.startSession();
    try {
      await finalizeSession.withTransaction(async () => {
        const order = await this.Order.findOne(
          { _id: oid, status: "cancel_pending" },
          { session: finalizeSession },
        );
        if (!order) return;
        await this.restoreOrderInventory(order, actor, finalizeSession);
        updated = await this.Order.findOneAndUpdate(
          { _id: oid, status: "cancel_pending" },
          {
            $set: {
              status: "canceled",
              inventory_restored_at: new Date(),
              updated_at: new Date(),
            },
            $push: { timeline: this.timelineItem("canceled", note) },
          },
          { returnDocument: "after", session: finalizeSession },
        );
        await this.Payment.updateOne(
          { _id: refundRequest.paymentId, status: "refund_pending" },
          {
            $set: {
              status: "refunded",
              refund_id: refund.id || null,
              refunded_at: new Date(),
              updated_at: new Date(),
            },
          },
          { session: finalizeSession },
        );
      });
    } finally {
      await finalizeSession.endSession();
    }

    // Another accepted cancellation can finalize this same idempotent refund.
    return updated || this.Order.findOne({ _id: oid });
  }

  async markPaidByPayPalTransaction(paypalOrderId) {
    const payment = await this.Payment.findOne({
      transaction_id: paypalOrderId,
    });

    if (!payment) {
      return { error: "Không tìm thấy payment" };
    }

    // Keep the legacy entry point but require the same provider evidence and
    // atomic transition as recovery. It cannot mark a refunded payment paid.
    const PaypalCheckoutService = require("./paypal-checkout.service");
    const result = await new PaypalCheckoutService(this.client).reconcileOrder({
      userId: payment.user_id, paypalOrderId,
    });
    if (result.status !== "completed") return { error: "PayPal chưa xác nhận giao dịch có thể hoàn tất" };
    return { ok: true, order: await this.getOrderDetail(String(payment.order_id)) };
  }

  async finalizePaypalPayment(paypalOrderId, paypalSnapshot) {
    const session = this.client.startSession();
    let orderId = null;
    try {
      await session.withTransaction(async () => {
        const payment = await this.Payment.findOne(
          { transaction_id: paypalOrderId },
          { session },
        );
        if (!payment) throw new Error("Không tìm thấy payment");
        orderId = payment.order_id;
        if (payment.status === "completed") return;
        const currentOrder = await this.Order.findOne({ _id: orderId }, { session });
        if (payment.method !== "paypal" || !currentOrder || !["awaiting_payment", "pending"].includes(normalizeOrderStatus(currentOrder.status))) {
          throw new ApiError(409, "Đơn hàng không ở trạng thái có thể ghi nhận thanh toán PayPal");
        }

        const paymentResult = await this.Payment.updateOne(
          {
            _id: payment._id,
            status: { $in: ["awaiting_capture", "capture_unknown", "pending"] },
          },
          {
            $set: {
              status: "completed",
              paypal: paypalSnapshot,
              paid_at: new Date(),
              updated_at: new Date(),
            },
          },
          { session },
        );
        if (paymentResult.modifiedCount !== 1) {
          throw new Error("Payment không ở trạng thái có thể hoàn tất");
        }

        // Capture evidence and its local intent commit with the payment/order.
        // Legacy payments may predate durable intents, so a missing intent is allowed.
        await this.PaymentIntent.updateOne(
          { paypalOrderId: String(paypalOrderId), userId: payment.user_id },
          { $set: { status: "captured", captureId: paypalSnapshot.capture_id,
            capturedAt: new Date(), updatedAt: new Date() } },
          { session },
        );

        await this.Order.updateOne(
          { _id: payment.order_id, status: "awaiting_payment" },
          {
            $set: {
              status: "pending",
              paypal: paypalSnapshot,
              updated_at: new Date(),
            },
            $push: {
              timeline: this.timelineItem(
                "pending",
                "Thanh toán PAYPAL thành công, chờ xác nhận",
              ),
            },
          },
          { session },
        );
        const order = await this.Order.findOne(
          { _id: payment.order_id },
          { session },
        );
        await this.outbox.enqueue(
          "notification.admin",
          this.buildOrderNotification(order, {
            ...payment,
            status: "completed",
          }),
          {
            session,
            idempotencyKey: `order-notification:${payment.order_id}`,
          },
        );
      });
    } finally {
      await session.endSession();
    }
    return orderId ? this.getOrderDetail(String(orderId)) : null;
  }

  async markPaypalCaptureUnknown(paypalOrderId, note) {
    return this.Payment.updateOne(
      {
        transaction_id: paypalOrderId,
        status: { $in: ["awaiting_capture", "pending"] },
      },
      {
        $set: {
          status: "capture_unknown",
          fail_note: String(note || "PayPal capture result is unknown").slice(
            0,
            500,
          ),
          updated_at: new Date(),
        },
      },
    );
  }

  async queueInvoiceEmail(order, customerEmail, customerName) {
    const oid = toObjectId(order?._id);
    if (!oid) return null;
    const session = this.client.startSession();
    let queued = null;
    try {
      await session.withTransaction(async () => {
        const current = await this.Order.findOne({ _id: oid }, { session });
        if (!current || current.invoice_sent) return;
        const event = await this.outbox.enqueue(
          "mail.invoice",
          { to: customerEmail, customerName, order },
          { session, idempotencyKey: `invoice:${oid}` },
        );
        await this.Order.updateOne(
          { _id: oid, invoice_sent: { $ne: true } },
          {
            $set: {
              invoice_outbox_id: event._id,
              invoice_queued_at: new Date(),
              updated_at: new Date(),
            },
          },
          { session },
        );
        queued = event;
      });
    } finally {
      await session.endSession();
    }
    return queued;
  }

  async getCheckoutPreview({
    userId,
    addressId,
    shippingMethodId,
    discountCode,
  }) {
    const plan = await this.buildCheckoutPlan({
      userId,
      addressId,
      shippingMethodId,
      discountCode,
      allocateBatches: false,
    });

    if (plan?.error) return { error: plan.error };

    return {
      ok: true,
      items: plan.items,
      subtotal_price: plan.subtotal_price,
      shipping_method_id: plan.shipping_method_id,
      shipping_method: plan.shipping_method,
      shipping_fee: plan.shipping_fee,
      discount: plan.discount,
      discount_amount: plan.discount_amount,
      pricing: plan.pricing,
      total_price: plan.total_price,
      address: plan.address,
    };
  }
}

module.exports = OrdersService;
