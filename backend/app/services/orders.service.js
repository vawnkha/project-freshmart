const { ObjectId } = require("mongodb");
const InventoryService = require("./inventory.service");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function getSummaryStock(summary) {
  if (!summary) return 0;
  if (summary.availableQuantity !== undefined) {
    return Number(summary.availableQuantity || 0);
  }
  return Number(summary.quantity || 0);
}

function getProductPrice(product = {}) {
  if (product.sellingPrice !== undefined) return Number(product.sellingPrice || 0);
  return Number(product.price || 0);
}

function getProductImage(product = {}) {
  if (product.thumbnail) return product.thumbnail;
  if (Array.isArray(product.images) && product.images[0]) return product.images[0];
  return "";
}

class OrdersService {
  constructor(client) {
    const db = client.db();
    this.client = client;
    this.Order = db.collection("orders");
    this.Cart = db.collection("carts");
    this.Product = db.collection("products");
    this.Address = db.collection("addresses");
    this.Payment = db.collection("payments");
    this.InventoryItem = db.collection("inventory_items");
    this.InventorySummary = db.collection("inventory_summaries");
    this.inventoryService = new InventoryService(client);
  }

  timelineItem(status, note = "") {
    return { status, changed_at: new Date(), note };
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
    if (!method) return "cod";
    return method === "cash" ? "cod" : method;
  }

  normalizeOrderItem(item = {}) {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const subtotal = Number(item.subtotal || item.totalPrice || price * quantity);

    return {
      product_id: item.product_id,
      productId: item.productId || item.product_id,
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
    return {
      _id: doc._id,
      user_id: doc.user_id,
      invoice_sent: doc.invoice_sent || false,
      invoice_sent_at: doc.invoice_sent_at || null,
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

      total_price: Number(doc.total_price || 0),

      created_at: doc.created_at,

      items: (doc.items || []).map((item) => this.normalizeOrderItem(item)),

      shipping_address: doc.address
        ? {
            _id: doc.address._id,
            fullName:
              doc.address.fullName ||
              doc.address.full_name ||
              doc.address.name ||
              "",
            address: doc.address.address_line || "",
            city: doc.address.city || "",
            phone: doc.address.phone || "",
            email: doc.address.email || "",
          }
        : null,

      timeline: doc.timeline || [],
    };
  }

  isLegacyCompatibleStatus(product) {
    if (!product.status) return true;
    return ["active", "in_stock"].includes(product.status);
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

  async buildCheckoutPlan({ userId, addressId, allocateBatches = true }) {
    const uid = toObjectId(userId);
    const aid = toObjectId(addressId);

    if (!uid || !aid) {
      return { error: "userId và addressId không hợp lệ" };
    }

    const cart = await this.Cart.findOne({ user_id: uid });
    if (!cart || !cart.items?.length) {
      return { error: "Giỏ hàng trống" };
    }

    const address = await this.Address.findOne({ _id: aid, user_id: uid });
    if (!address) {
      return { error: "Địa chỉ giao hàng không hợp lệ" };
    }

    const ids = cart.items.map((item) => toObjectId(item.product_id)).filter(Boolean);
    const products = await this.Product.find({ _id: { $in: ids } }).toArray();
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    let total = 0;
    const orderItems = [];

    for (const cartItem of cart.items) {
      const product = productMap.get(String(cartItem.product_id));
      if (!product) continue;

      const qty = Math.max(parseInt(cartItem.quantity, 10) || 1, 1);
      const price = getProductPrice(product);
      const inventoryItemId = toObjectId(product.inventoryItemId);

      if (inventoryItemId) {
        if (product.status !== "active") {
          return { error: `Sản phẩm "${product.name}" chưa được kích hoạt` };
        }

        const inventoryItem = await this.InventoryItem.findOne({
          _id: inventoryItemId,
        });
        if (!inventoryItem || inventoryItem.status === "inactive") {
          return { error: `Hàng kho của "${product.name}" không hoạt động` };
        }

        const summary = await this.InventorySummary.findOne({ inventoryItemId });
        const stock = getSummaryStock(summary);
        if (stock < qty) {
          return { error: `Sản phẩm "${product.name}" không đủ tồn kho` };
        }

        const allocationResult = allocateBatches
          ? await this.inventoryService.allocateFefo(inventoryItemId, qty)
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

    return {
      ok: true,
      uid,
      aid,
      cart,
      address,
      items: orderItems,
      total_price: total,
    };
  }

  async deductCheckoutStock(orderItems, orderId, userId, session) {
    const actor = { _id: userId };

    for (const item of orderItems) {
      if (item.inventoryItemId && item.batchAllocations?.length) {
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

  async createFromCart({ userId, addressId, payment_method }) {
    const method = payment_method || "cash";
    const plan = await this.buildCheckoutPlan({
      userId,
      addressId,
      allocateBatches: true,
    });

    if (plan?.error) return { error: plan.error };

    const initialStatus = "pending";
    const orderDoc = {
      user_id: plan.uid,
      items: plan.items,
      address_id: plan.aid,
      total_price: plan.total_price,
      status: initialStatus,
      timeline: [this.timelineItem("pending", "Tạo đơn hàng")],
      created_at: new Date(),
    };

    const paymentDoc = {
      order_id: null,
      method,
      transaction_id: null,
      amount: plan.total_price,
      status: "pending",
      paid_at: null,
      created_at: new Date(),
    };

    const session = this.client.startSession();
    let result = null;

    try {
      await session.withTransaction(async () => {
        const orderRs = await this.Order.insertOne(orderDoc, { session });
        paymentDoc.order_id = orderRs.insertedId;

        const paymentRs = await this.Payment.insertOne(paymentDoc, { session });

        await this.deductCheckoutStock(
          plan.items,
          orderRs.insertedId,
          plan.uid,
          session,
        );

        await this.clearUserCart(plan.uid, { session });

        result = {
          ok: true,
          order: { _id: orderRs.insertedId, ...orderDoc },
          payment: { _id: paymentRs.insertedId, ...paymentDoc },
        };
      });
    } catch (error) {
      return { error: error.message || "Không thể tạo đơn hàng" };
    } finally {
      await session.endSession();
    }

    return result;
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

    return this.normalizeOrder(doc);
  }

  async pushStatus(orderId, status, note = "") {
    const oid = toObjectId(orderId);
    if (!oid) return null;

    return await this.Order.findOneAndUpdate(
      { _id: oid },
      {
        $set: { status },
        $push: { timeline: this.timelineItem(status, note) },
      },
      { returnDocument: "after" },
    );
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

    try {
      await session.withTransaction(async () => {
        const order = await this.Order.findOne({ _id: oid }, { session });
        if (!order) return;
        if (order.status !== "pending") {
          throw new Error("Chỉ được hủy đơn đang chờ xác nhận");
        }

        await this.restoreOrderInventory(order, actor, session);

        updated = await this.Order.findOneAndUpdate(
          { _id: oid },
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

    return updated;
  }

  async markPaidByPayPalTransaction(paypalOrderId) {
    const payment = await this.Payment.findOne({
      transaction_id: paypalOrderId,
    });

    if (!payment) {
      return { error: "Không tìm thấy payment" };
    }

    if (payment.status === "completed") {
      const order = await this.getOrderDetail(String(payment.order_id));
      return { ok: true, order };
    }

    const order = await this.Order.findOne({ _id: payment.order_id });
    if (!order) {
      return { error: "Không tìm thấy order" };
    }

    await this.Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "completed",
          paid_at: new Date(),
        },
      },
    );

    await this.Order.updateOne(
      { _id: order._id },
      {
        $push: {
          timeline: this.timelineItem(
            "pending",
            "Thanh toán PAYPAL thành công, chờ xác nhận",
          ),
        },
      },
    );

    const detail = await this.getOrderDetail(String(order._id));
    return { ok: true, order: detail };
  }

  async getCheckoutPreview({ userId, addressId }) {
    const plan = await this.buildCheckoutPlan({
      userId,
      addressId,
      allocateBatches: false,
    });

    if (plan?.error) return { error: plan.error };

    return {
      ok: true,
      items: plan.items,
      total_price: plan.total_price,
      address: plan.address,
    };
  }
}

module.exports = OrdersService;
