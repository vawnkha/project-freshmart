const { ObjectId } = require("mongodb");
const { classifyExpiry } = require("../utils/expiry.util");
const NotificationsService = require("./notifications.service");

const ACTIVE_OBLIGATION_STATUSES = ["awaiting_payment", "pending", "processing"];
const DELIVERABLE_BATCH_STATUSES = ["available", "sold_out"];

class OrderBatchAlertService {
  constructor(client) {
    this.client = client;
    const db = client.db();
    this.orders = db.collection("orders");
    this.batches = db.collection("inventory_batches");
    this.notifications = new NotificationsService(client);
  }

  isActiveOrder(order) {
    return ACTIVE_OBLIGATION_STATUSES.includes(String(order?.status || ""));
  }

  issueFor(item, allocation, batch, now = new Date()) {
    const expiry = batch?.expiryDate instanceof Date
      ? classifyExpiry(batch.expiryDate, now)
      : { daysRemaining: null };
    const expired = !batch || !(batch.expiryDate instanceof Date) || !(expiry.daysRemaining > 0);
    const locked = Boolean(batch) && !DELIVERABLE_BATCH_STATUSES.includes(batch.status);
    if (!expired && !locked) return null;
    return {
      productName: item.productName || item.name || batch?.itemName || "Sản phẩm",
      batchId: String(batch?._id || allocation.batchId || ""),
      batchNumber: batch?.batchNumber || allocation.batchNumber || "Chưa xác định",
      quantity: Number(allocation.quantity || 0),
      expiryDate: batch?.expiryDate || allocation.expiryDate || null,
      status: batch?.status || "missing",
      reason: expired ? "expired" : "locked",
    };
  }

  buildAlert(order, batchesById, audience = "customer", now = new Date()) {
    if (!this.isActiveOrder(order)) return null;
    const affectedItems = [];
    for (const item of order.items || []) for (const allocation of item.batchAllocations || []) {
      const issue = this.issueFor(item, allocation, batchesById.get(String(allocation.batchId)), now);
      if (issue) affectedItems.push(issue);
    }
    if (!affectedItems.length) return null;
    const hasExpired = affectedItems.some(item => item.reason === "expired");
    const hasLocked = affectedItems.some(item => item.reason === "locked");
    const code = hasExpired ? "ORDER_BATCH_EXPIRED" : "ORDER_BATCH_LOCKED";
    if (audience !== "admin") return {
      blocked: true,
      code,
      title: "Đơn hàng đang tạm hoãn xử lý",
      message: "Một số sản phẩm trong đơn hàng cần được kiểm tra lại về điều kiện cung cấp. Đơn hàng hiện chưa thể tiếp tục giao. Vui lòng liên hệ bộ phận hỗ trợ để được hướng dẫn.",
      affectedCount: affectedItems.length,
    };
    return {
      blocked: true,
      code,
      title: "Không thể tiếp tục xử lý đơn hàng",
      message: hasExpired && hasLocked
        ? "Đơn hàng có lô đã hết hạn và lô đang bị khóa."
        : hasExpired
          ? "Không thể tiếp tục giao hàng vì đơn có lô đã hết hạn dùng (hạn sử dụng)."
          : "Không thể tiếp tục giao hàng vì đơn có lô đang bị khóa.",
      guidance: "Vui lòng kiểm tra thông tin lô hàng và liên hệ khách hàng để thống nhất phương án xử lý trước khi tiếp tục giao hàng.",
      orderId: String(order._id),
      affectedItems,
    };
  }

  async decorate(orders, audience = "customer", { session, now = new Date() } = {}) {
    const list = Array.isArray(orders) ? orders : [orders];
    const ids = [...new Set(list.flatMap(order => this.isActiveOrder(order)
      ? (order.items || []).flatMap(item => (item.batchAllocations || []).map(row => String(row.batchId)))
      : []).filter(ObjectId.isValid))].map(id => new ObjectId(id));
    const batches = ids.length
      ? await this.batches.find({ _id: { $in: ids } }, { session }).toArray()
      : [];
    const batchesById = new Map(batches.map(batch => [String(batch._id), batch]));
    for (const order of list) order.deliveryAlert = this.buildAlert(order, batchesById, audience, now);
    return Array.isArray(orders) ? list : list[0];
  }

  async collect(order, audience = "admin", options = {}) {
    return (await this.decorate(order, audience, options)).deliveryAlert;
  }

  async notifyForBatch(batch, reason, { session, incidentKey } = {}) {
    if (!batch?._id || !["locked", "expired"].includes(reason)) return [];
    const batchId = String(batch._id);
    const orders = await this.orders.find({
      status: { $in: ACTIVE_OBLIGATION_STATUSES },
      "items.batchAllocations.batchId": { $in: [batch._id, batchId] },
    }, { session }).toArray();
    const created = [];
    for (const order of orders) {
      const alert = await this.collect(order, "admin", { session });
      const affected = alert?.affectedItems?.filter(item => item.batchId === batchId && item.reason === reason) || [];
      if (!affected.length) continue;
      const orderId = String(order._id);
      const productNames = [...new Set(affected.map(item => item.productName))].join(", ");
      const baseKey = `order-batch:${orderId}:${batchId}:${reason}:${incidentKey || batch.expiryDate?.toISOString?.() || "current"}`;
      created.push(await this.notifications.createOnce({
        type: "order",
        title: `Đơn hàng cần kiểm tra lô`,
        content: `Đơn hàng ${orderId} đang sử dụng lô ${batch.batchNumber || batchId} không còn đủ điều kiện giao (${reason === "expired" ? "đã hết hạn" : "đang khóa"}) cho ${productNames}.`,
        data: { audience: "admin", order_id: orderId, batchId, reason, url: `/admin/orders/${orderId}` },
      }, `${baseKey}:admin`, { session, emitAdmin: true }));
      created.push(await this.notifications.createOnce({
        type: "order_issue",
        title: "Đơn hàng cần được kiểm tra thêm",
        content: `Đơn hàng ${orderId} hiện cần được kiểm tra thêm trước khi giao. Vui lòng xem chi tiết hoặc liên hệ hỗ trợ.`,
        data: { audience: "customer", userId: String(order.user_id), orderId, url: `/profile?tab=orders&orderId=${orderId}` },
      }, `${baseKey}:customer`, { session, emitAdmin: false }));
    }
    return created;
  }
}

OrderBatchAlertService.ACTIVE_OBLIGATION_STATUSES = ACTIVE_OBLIGATION_STATUSES;
module.exports = OrderBatchAlertService;
