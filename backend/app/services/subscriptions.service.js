const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const OrdersService = require("./orders.service");
const NotificationsService = require("./notifications.service");
const { SubscriptionRepository, objectId } = require("../repositories/subscription.repository");
const { subscriptionConfig } = require("../config/subscriptions");
const { buildSchedule, localDay, calendarDate } = require("../utils/subscription-schedule.util");
const { subscriptionBody } = require("../validators/subscription.validator");
const { getJwtConfig } = require("../config/security");

const TERMINAL_RUNS = ["order_created", "skipped"];
const LIVE_STATES = ["active", "paused"];
const labels = {
  created: "Đã đăng ký giao hàng định kỳ", edited: "Đã cập nhật đăng ký định kỳ",
  paused: "Đăng ký định kỳ đã tạm dừng", resumed: "Đăng ký định kỳ đã tiếp tục",
  cancelled: "Đăng ký định kỳ đã hủy", completed: "Đăng ký định kỳ đã hoàn tất",
  upcoming: "Sắp đến kỳ giao hàng", order_created: "Đã tạo đơn hàng định kỳ",
  pending_payment: "Kỳ giao đang chờ bạn thanh toán PayPal", pending_confirmation: "Kỳ giao cần bạn xác nhận giá",
  failed: "Không thể xử lý kỳ giao", skipped: "Đã bỏ qua kỳ giao", retry: "Đã yêu cầu thử lại kỳ giao",
};

function parsedBody(payload) {
  const parsed = subscriptionBody.safeParse(payload);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map(issue => issue.message).join("; "));
  return parsed.data;
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

class SubscriptionsService {
  constructor(client, options = {}) {
    this.client = client;
    this.repo = new SubscriptionRepository(client);
    this.orders = new OrdersService(client);
    this.notifications = new NotificationsService(client);
    this.config = options.config || subscriptionConfig();
    this.now = options.now || (() => new Date());
    // Only tests inject faults; never populated from HTTP or environment.
    this.fault = options.fault;
  }

  assertEnabled() {
    if (!this.config.enabled) throw new ApiError(503, "Cửa hàng chưa mở đăng ký giao hàng định kỳ");
  }

  eligible(product) {
    return !!product && product.status === "active" && product.subscriptionEligible !== false
      && (!this.config.productIds.length || this.config.productIds.includes(String(product._id)));
  }

  async policy(productId) {
    const product = productId ? await this.orders.Product.findOne({ _id: objectId(productId) }) : null;
    return {
      enabled: this.config.enabled, eligible: this.config.enabled && this.eligible(product),
      longMinDays: require('../config/environment').read('EXPIRY_LONG_MIN_DAYS'),
      timezone: this.config.timezone, leadDays: this.config.leadDays,
      priceIncreasePercent: this.config.priceIncreasePercent, maxOccurrences: this.config.maxOccurrences,
      today: localDay(this.now()), paymentMethods: ["cod", "paypal"],
      pricePolicy: "Giá trị đơn hàng dự kiến có thể thay đổi theo giá bán và chương trình khuyến mãi tại thời điểm xử lý từng kỳ.",
      deliveryPolicy: "Ngày mong muốn nhận hàng là mốc lập lịch, không phải cam kết giao đúng ngày. Đơn được tạo trước mốc này theo số ngày chuẩn bị của cửa hàng.",
    };
  }

  async catalog(keyword = "") {
    if (!this.config.enabled) return { items: [] };
    const filter = { status: "active", subscriptionEligible: { $ne: false },
      ...(this.config.productIds.length ? { _id: { $in: this.config.productIds.map(objectId) } } : {}),
      ...(keyword ? { name: { $regex: escapeRegex(keyword), $options: "i" } } : {}),
    };
    const items = await this.orders.Product.find(filter, { projection: { name: 1, inventoryItemId: 1, sellingPrice: 1, price: 1, unit: 1, packageSize: 1, thumbnail: 1 } }).sort({ name: 1, _id: 1 }).limit(20).toArray();
    return { items };
  }

  schedule(input) { return buildSchedule(input, { leadDays: this.config.leadDays, limit: this.config.maxOccurrences }); }

  quoteToken(userId, input, total, timestamp = +this.now()) {
    const normalized = { ...input }; delete normalized.quoteToken;
    const digest = crypto.createHmac("sha256", getJwtConfig().secret)
      .update(JSON.stringify([String(userId), normalized, total, timestamp])).digest("hex");
    return `${timestamp}.${total}.${digest}`;
  }

  verifyQuote(userId, input, total) {
    const token = input.quoteToken || "";
    const timestamp = Number(token.split(".")[0]);
    const expected = this.quoteToken(userId, input, total, timestamp);
    if (!Number.isFinite(timestamp) || timestamp > +this.now() || +this.now() - timestamp > 600000
      || Buffer.byteLength(token) !== Buffer.byteLength(expected)
      || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      throw new ApiError(409, "Giá hoặc lựa chọn đã thay đổi. Hãy xem lại lịch và giá trước khi xác nhận.", "SUBSCRIPTION_QUOTE_CHANGED");
    }
  }

  async validateProducts(items, session) {
    const products = await this.orders.Product.find({ _id: { $in: items.map(item => objectId(item.productId)) } }, { session }).toArray();
    for (const item of items) {
      const product = products.find(row => String(row._id) === item.productId);
      if (!this.eligible(product)) throw new ApiError(409, "Sản phẩm không còn đủ điều kiện mua định kỳ", "SUBSCRIPTION_PRODUCT_UNAVAILABLE");
      const price = Number(product.sellingPrice ?? product.price);
      if (!Number.isFinite(price) || price <= 0) throw new ApiError(409, "Sản phẩm chưa có giá bán hợp lệ");
    }
    return products;
  }

  async checkout(userId, input, session) {
    const user = await this.client.db().collection("users").findOne({ _id: objectId(userId) }, { session, projection: { status: 1 } });
    if (!user || ["pending", "blocked", "deleted"].includes(user.status)) throw new ApiError(409, "Tài khoản không còn được phép tạo đơn định kỳ", "SUBSCRIPTION_ACCOUNT_UNAVAILABLE");
    await this.validateProducts(input.items, session);
    const plan = await this.orders.buildCheckoutPlan({
      userId, addressId: input.addressId, shippingMethodId: input.shippingMethodId,
      discountCode: input.discountCode, sourceItems: input.items, session,
    });
    if (plan.error) throw new ApiError(409, plan.error, "SUBSCRIPTION_CHECKOUT_UNAVAILABLE");
    if (!Number.isSafeInteger(plan.total_price) || plan.total_price <= 0) throw new ApiError(409, "Giá trị đơn hàng không hợp lệ");
    return plan;
  }

  async preview(userId, payload, { editing = false, subscriptionId } = {}) {
    this.assertEnabled();
    const input = parsedBody(payload);
    if (!editing && input.startDate < localDay(this.now())) throw new ApiError(400, "Ngày bắt đầu không được ở quá khứ");
    const schedule = this.schedule(input);
    let visibleSchedule = schedule, lockedOccurrenceCount = 0;
    if (editing && subscriptionId) {
      const sub = await this.repo.owned(subscriptionId, userId);
      if (!LIVE_STATES.includes(sub.status)) throw new ApiError(409, "Đăng ký đã kết thúc");
      const locked = await this.repo.runs.find({ subscriptionId: sub._id, $or: [{ status: { $ne: "scheduled" } }, { startedAt: { $exists: true } }] }).toArray();
      if (locked.some(run => run.status === "processing")) throw new ApiError(409, "Kỳ giao đang xử lý, hãy xem lại sau khi xử lý xong");
      if (input.startDate !== sub.startDate || (input.frequency !== sub.frequency && locked.length)) throw new ApiError(409, "Lịch sử đã bắt đầu xử lý phải giữ chu kỳ và ngày gốc");
      if (locked.some(run => run.occurrenceNumber > schedule.length)) throw new ApiError(409, "Không được xóa kỳ đã bắt đầu xử lý");
      const numbers = new Set(locked.map(run => run.occurrenceNumber));
      visibleSchedule = schedule.filter(row => !numbers.has(row.occurrenceNumber) && row.wishDate >= localDay(this.now()));
      lockedOccurrenceCount = locked.length;
    }
    const plan = await this.checkout(userId, input);
    return {
      schedule: visibleSchedule, totalOccurrences: schedule.length, futureOccurrences: visibleSchedule.length, lockedOccurrenceCount, estimatedTotal: plan.total_price,
      estimatedAllOccurrences: plan.total_price * visibleSchedule.length,
      subtotal: plan.subtotal_price, shippingFee: plan.shipping_fee, discountAmount: plan.discount_amount,
      items: plan.items.map(item => ({ productId: item.productId, name: item.name, image: item.image, unit: item.unit, packageSize: item.packageSize, price: item.price, quantity: item.quantity, ...(item.expiryChoice ? { expiryChoice: item.expiryChoice, expiryQuote: item.expiryQuote } : {}) })),
      quoteToken: this.quoteToken(userId, input, plan.total_price), policy: await this.policy(),
    };
  }

  async notice(sub, type, { run, reason = "", key, session } = {}) {
    const eventKey = key || `subscription:${sub._id}:${type}:${sub.version || 0}`;
    return this.notifications.createOnce({
      type: "subscription", title: labels[type] || type,
      content: `${sub.code}${run ? ` · Kỳ ${run.occurrenceNumber}` : ""}${reason ? ` · ${reason}` : ""}`,
      data: { subscriptionId: sub._id, userId: sub.userId, event: type, ...(run ? { runId: run._id, occurrenceNumber: run.occurrenceNumber, orderId: run.orderId || null } : {}) },
    }, eventKey, { session });
  }

  log(type, sub, extra = {}) {
    // No address, notes, tokens or provider payloads in audit logs.
    return { type, at: this.now(), ...extra };
  }

  async create(userId, payload) {
    this.assertEnabled();
    const input = parsedBody(payload);
    if (input.startDate < localDay(this.now())) throw new ApiError(400, "Ngày bắt đầu không được ở quá khứ");
    const schedule = this.schedule(input);
    return this.repo.transaction(async session => {
      const plan = await this.checkout(userId, input, session);
      this.verifyQuote(userId, input, plan.total_price);
      if (input.maximumTotal < plan.total_price) throw new ApiError(400, "Giới hạn mỗi kỳ phải đủ cho giá dự kiến hiện tại");
      const _id = new ObjectId();
      const sub = {
        _id, userId: objectId(userId), code: `SUB-${String(_id).toUpperCase()}`,
        ...this.storedInput(input, plan), status: "active", version: 1,
        nextScheduledDate: schedule[0].scheduledDate, completedOccurrences: 0,
        totalOccurrences: schedule.length, audit: [this.log("created", null, { actorId: objectId(userId), confirmedTotal: plan.total_price, maximumTotal: input.maximumTotal, priceIncreasePercent: this.config.priceIncreasePercent })], createdAt: this.now(), updatedAt: this.now(),
      };
      await this.orders.deletion.withReferences(this.references(sub), async () => {}, { session });
      await this.repo.subscriptions.insertOne(sub, { session });
      await this.repo.runs.insertMany(schedule.map(row => ({
        _id: new ObjectId(), subscriptionId: _id, userId: sub.userId, ...row, status: "scheduled", attempts: 0,
        idempotencyKey: `subscription:${_id}:${row.occurrenceNumber}`, createdAt: this.now(), updatedAt: this.now(), audit: [],
      })), { session });
      await this.notice(sub, "created", { session });
      return sub;
    });
  }

  references(sub) {
    return [{ collection: "users", id: sub.userId }, { collection: "addresses", id: sub.addressId },
      { collection: "shipping_methods", id: sub.shippingMethodId }, ...sub.items.map(item => ({ collection: "products", id: item.productId }))];
  }

  storedInput(input, plan) {
    return {
      items: plan.items.map(item => ({ productId: item.productId, quantity: item.quantity,
        ...(item.expiryChoice ? { expiryChoice: item.expiryChoice } : {}),
        productSnapshot: { name: item.name, unit: item.unit || "", packageSize: item.packageSize || "", image: item.image || "" } })),
      frequency: input.frequency, startDate: input.startDate, endDate: input.endDate || null,
      maxOccurrences: input.maxOccurrences || null, anchorDay: Number(input.startDate.slice(-2)),
      addressId: objectId(input.addressId), shippingAddress: { full_name: plan.address.full_name || plan.address.fullName || "", phone: plan.address.phone || "", address_line: plan.address.address_line || "", city: plan.address.city || "" },
      shippingMethodId: objectId(input.shippingMethodId), shippingMethod: plan.shipping_method,
      paymentMethod: input.paymentMethod, notes: input.notes, discountCode: input.discountCode,
      confirmedTotal: plan.total_price, maximumTotal: input.maximumTotal,
      consentAt: this.now(), priceIncreasePercent: this.config.priceIncreasePercent,
    };
  }

  inputFor(sub) {
    return {
      items: sub.items.map(item => ({ productId: String(item.productId), quantity: item.quantity, ...(item.expiryChoice ? { expiryChoice: item.expiryChoice } : {}) })),
      frequency: sub.frequency, startDate: sub.startDate,
      ...(sub.endDate ? { endDate: sub.endDate } : { maxOccurrences: sub.maxOccurrences }),
      addressId: String(sub.addressId), shippingMethodId: String(sub.shippingMethodId),
      paymentMethod: sub.paymentMethod, notes: sub.notes, discountCode: sub.discountCode,
      maximumTotal: sub.maximumTotal, consent: true,
    };
  }

  async detail(id, userId, { admin = false } = {}) {
    const sub = await this.repo.owned(id, userId, { admin });
    const runs = await this.repo.runs.find({ subscriptionId: sub._id }).sort({ occurrenceNumber: 1 }).toArray();
    const orderIds = runs.map(row => row.orderId).filter(Boolean);
    const orders = orderIds.length ? await this.orders.Order.aggregate([
      { $match: { _id: { $in: orderIds } } },
      { $lookup: { from: "payments", localField: "_id", foreignField: "order_id", as: "payment" } },
      { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
    ]).toArray() : [];
    const notifications = await this.repo.events.find({ type: "subscription", "data.subscriptionId": sub._id, "data.userId": sub.userId }).sort({ created_at: -1 }).limit(30).toArray();
    const customer = admin ? await this.client.db().collection("users").findOne({ _id: sub.userId }, { projection: { name: 1, email: 1 } }) : undefined;
    return { ...sub, runs: runs.map(({ leaseToken: _token, ...run }) => run), orders: orders.map(order => this.orders.normalizeOrder(order)), notifications, ...(admin ? { customer } : {}) };
  }

  async list(userId, query, { admin = false } = {}) {
    const filter = admin ? {} : { userId: objectId(userId) };
    if (query.status) filter.status = query.status;
    if (query.from || query.to) filter.createdAt = {
      ...(query.from ? { $gte: new Date(`${calendarDate(query.from).toISOString().slice(0, 10)}T00:00:00+07:00`) } : {}),
      ...(query.to ? { $lt: new Date(+new Date(`${calendarDate(query.to).toISOString().slice(0, 10)}T00:00:00+07:00`) + 86400000) } : {}),
    };
    if (query.keyword) {
      const regex = { $regex: escapeRegex(query.keyword), $options: "i" };
      filter.$or = [{ code: regex }, { "items.productSnapshot.name": regex }];
      if (admin) {
        const users = await this.client.db().collection("users").find({ $or: [{ name: regex }, { email: regex }] }, { projection: { _id: 1 } }).limit(1000).toArray();
        filter.$or.push({ userId: { $in: users.map(user => user._id) } });
      }
    }
    const sort = query.sort === "next" ? { nextScheduledDate: 1, _id: 1 } : { createdAt: query.sort === "oldest" ? 1 : -1, _id: 1 };
    const [items, total] = await Promise.all([
      this.repo.subscriptions.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).toArray(), this.repo.subscriptions.countDocuments(filter),
    ]);
    if (admin) {
      const customers = await this.client.db().collection("users").find({ _id: { $in: items.map(item => item.userId) } }, { projection: { name: 1, email: 1 } }).toArray();
      for (const item of items) item.customer = customers.find(user => String(user._id) === String(item.userId)) || null;
    }
    return { items, total, page: query.page, limit: query.limit };
  }

  async summary() {
    const [states, runs] = await Promise.all([
      this.repo.subscriptions.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
      this.repo.runs.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
    ]);
    const upcoming = await this.repo.runs.countDocuments({ status: "scheduled", processAt: { $gte: this.now(), $lte: new Date(+this.now() + 7 * 86400000) }, subscriptionId: { $in: await this.repo.subscriptions.distinct("_id", { status: "active" }) } });
    const counts = Object.fromEntries(states.map(row => [row._id, row.count]));
    return { total: states.reduce((sum, row) => sum + row.count, 0), active: counts.active || 0, paused: counts.paused || 0,
      upcoming, failed: runs.find(row => row._id === "failed")?.count || 0, orders: runs.find(row => row._id === "order_created")?.count || 0 };
  }

  async refresh(sub, session) {
    const unfinished = await this.repo.runs.find({ subscriptionId: sub._id, status: { $nin: TERMINAL_RUNS } }, { session }).sort({ occurrenceNumber: 1 }).limit(1).next();
    const completedOccurrences = await this.repo.runs.countDocuments({ subscriptionId: sub._id, status: "order_created" }, { session });
    const completed = !unfinished && LIVE_STATES.includes(sub.status);
    await this.repo.subscriptions.updateOne({ _id: sub._id }, { $set: {
      nextScheduledDate: unfinished?.scheduledDate || null, completedOccurrences, updatedAt: this.now(), ...(completed ? { status: "completed" } : {}),
    } }, { session });
    if (completed) await this.notice(sub, "completed", { session, key: `subscription:${sub._id}:completed` });
  }

  async lifecycle(id, userId, action) {
    return this.repo.transaction(async session => {
      const sub = await this.repo.owned(id, userId, { session });
      const allowed = { pause: ["active"], resume: ["paused"], cancel: ["active", "paused"] };
      if (!allowed[action]?.includes(sub.status)) throw new ApiError(409, "Không thể thực hiện thao tác ở trạng thái này");
      const status = { pause: "paused", resume: "active", cancel: "cancelled" }[action];
      await this.repo.subscriptions.updateOne({ _id: sub._id, version: sub.version }, { $set: { status, updatedAt: this.now() }, $inc: { version: 1 }, $push: { audit: this.log(action) } }, { session });
      sub.status = status; sub.version++;
      if (action === "pause") {
        await this.repo.runs.updateMany({ subscriptionId: sub._id, status: "processing", orderId: { $exists: false } }, {
          $set: { status: "scheduled", updatedAt: this.now() }, $unset: { leaseToken: "", leaseUntil: "" },
          $push: { audit: this.log("processing_paused") },
        }, { session });
      }
      // This write serializes pause/cancel with a transaction already processing an order.
      // Existing orders and their payments are never touched here.
      if (action === "resume" || action === "cancel") {
        await this.repo.runs.updateMany({ subscriptionId: sub._id, orderId: { $exists: false }, status: { $ne: "skipped" },
          ...(action === "resume" ? { wishDate: { $lt: localDay(this.now()) } } : {}),
        }, { $set: { status: "skipped", reason: action === "resume" ? "Kỳ đã trôi qua trong thời gian tạm dừng" : "Đã hủy đăng ký", updatedAt: this.now() },
          $unset: { leaseToken: "", leaseUntil: "" }, $push: { audit: this.log("skipped", sub, { reason: action }) } }, { session });
      }
      await this.refresh(sub, session);
      await this.notice(sub, { pause: "paused", resume: "resumed", cancel: "cancelled" }[action], { session });
    });
  }

  async edit(id, userId, payload) {
    this.assertEnabled();
    const input = parsedBody(payload);
    return this.repo.transaction(async session => {
      const sub = await this.repo.owned(id, userId, { session });
      if (!LIVE_STATES.includes(sub.status)) throw new ApiError(409, "Đăng ký đã kết thúc");
      if (await this.repo.runs.findOne({ subscriptionId: sub._id, status: "processing" }, { session })) throw new ApiError(409, "Kỳ giao đang xử lý, hãy thử chỉnh sửa sau khi xử lý xong");
      if (input.startDate !== sub.startDate) throw new ApiError(400, "Giữ ngày bắt đầu gốc; tạo đăng ký khác nếu muốn đổi ngày gốc");
      const schedule = this.schedule(input);
      const plan = await this.checkout(userId, input, session);
      this.verifyQuote(userId, input, plan.total_price);
      if (input.maximumTotal < plan.total_price) throw new ApiError(400, "Giới hạn mỗi kỳ thấp hơn tổng dự kiến");
      const existing = await this.repo.runs.find({ subscriptionId: sub._id }, { session }).toArray();
      const locked = existing.filter(run => run.status !== "scheduled" || run.startedAt);
      if (input.frequency !== sub.frequency && locked.length) throw new ApiError(409, "Chỉ đổi chu kỳ trước khi bất kỳ kỳ nào bắt đầu xử lý; lịch sử đã có phải giữ chu kỳ gốc");
      if (locked.some(run => run.occurrenceNumber > schedule.length)) throw new ApiError(409, "Không được xóa kỳ đã bắt đầu xử lý");
      await this.orders.deletion.withReferences(this.references({ ...sub, ...this.storedInput(input, plan) }), async () => {}, { session });
      await this.repo.subscriptions.updateOne({ _id: sub._id, version: sub.version }, { $set: { ...this.storedInput(input, plan), totalOccurrences: schedule.length, updatedAt: this.now() }, $inc: { version: 1 }, $push: { audit: this.log("edited", sub, { actorId: objectId(userId), confirmedTotal: plan.total_price, maximumTotal: input.maximumTotal, priceIncreasePercent: this.config.priceIncreasePercent }) } }, { session });
      // Only unstarted rows can be removed or added; failed/payment/confirmation rows keep their snapshot.
      await this.repo.runs.updateMany({ subscriptionId: sub._id, status: "scheduled", startedAt: { $exists: false } }, { $unset: { inputSnapshot: "", priceConsent: "", approvedMaximum: "", approvedTotal: "" } }, { session });
      await this.repo.runs.deleteMany({ subscriptionId: sub._id, status: "scheduled", startedAt: { $exists: false }, occurrenceNumber: { $gt: schedule.length } }, { session });
      for (const row of schedule) {
        const prior = existing.find(run => run.occurrenceNumber === row.occurrenceNumber);
        const status = row.wishDate < localDay(this.now()) ? "skipped" : "scheduled";
        if (prior?.status === "scheduled" && !prior.startedAt) {
          await this.repo.runs.updateOne({ _id: prior._id, status: "scheduled" }, { $set: { ...row, status, updatedAt: this.now(),
            ...(status === "skipped" ? { reason: "Kỳ đã trôi qua; không tự tạo đơn bù sau chỉnh sửa" } : {}) } }, { session });
        } else if (!prior) await this.repo.runs.insertOne({ _id: new ObjectId(), ...row, subscriptionId: sub._id, userId: sub.userId,
          status, attempts: 0, idempotencyKey: `subscription:${sub._id}:${row.occurrenceNumber}`, createdAt: this.now(), updatedAt: this.now(), audit: [] }, { session });
      }
      sub.version++;
      await this.refresh(sub, session);
      await this.notice(sub, "edited", { session });
    });
  }

  ceiling(sub, run) {
    const policy = run.priceConsent || sub;
    return Math.min(run.approvedMaximum ?? policy.maximumTotal, Math.floor((run.approvedTotal ?? policy.confirmedTotal) * (1 + policy.priceIncreasePercent / 100)));
  }

  async claim(runId, { manual = false } = {}) {
    return this.repo.transaction(async session => {
      const run = await this.repo.runs.findOne({ _id: objectId(runId) }, { session });
      if (!run || run.orderId || TERMINAL_RUNS.includes(run.status)) return null;
      const sub = await this.repo.subscriptions.findOne({ _id: run.subscriptionId, status: "active" }, { session });
      if (!sub) return null;
      const previous = await this.repo.runs.findOne({ subscriptionId: sub._id, occurrenceNumber: { $lt: run.occurrenceNumber }, status: { $nin: TERMINAL_RUNS } }, { session });
      if (previous) return null;
      const now = this.now();
      const ready = (run.status === "scheduled" && +run.processAt <= +now)
        || (run.status === "failed" && run.attempts < this.config.maxAttempts && +run.nextRetryAt <= +now)
        || (run.status === "processing" && +run.leaseUntil <= +now)
        || (manual && ["pending_confirmation", "pending_payment"].includes(run.status));
      if (!ready) return null;
      await this.repo.subscriptions.updateOne({ _id: sub._id, version: sub.version }, { $inc: { version: 1 } }, { session });
      if ((run.status === "processing" || (run.status === "scheduled" && run.startedAt)) && run.attempts >= this.config.maxAttempts
        && !(await this.orders.Order.findOne({ subscriptionRunId: run._id }, { session }))) {
        const reason = "Đã hết số lần khôi phục tự động; cần quản trị viên kiểm tra và thử lại";
        await this.repo.runs.updateOne({ _id: run._id }, { $set: { status: "failed", errorCode: "SUBSCRIPTION_LEASE_EXHAUSTED", lastError: reason, updatedAt: now },
          $unset: { leaseToken: "", leaseUntil: "" }, $push: { audit: this.log("failed", sub, { reason }) } }, { session });
        await this.notice(sub, "failed", { run, reason, session, key: `${run.idempotencyKey}:failed` });
        return null;
      }
      if (run.wishDate < localDay(now) && !manual) {
        await this.repo.runs.updateOne({ _id: run._id }, { $set: { status: "skipped", reason: "Đã quá ngày mong muốn; không tự tạo đơn bù", updatedAt: now }, $push: { audit: this.log("skipped") } }, { session });
        await this.refresh(sub, session);
        await this.notice(sub, "skipped", { run, session, key: `${run.idempotencyKey}:skipped` });
        return null;
      }
      const token = crypto.randomUUID();
      const claimed = await this.repo.runs.findOneAndUpdate({ _id: run._id, status: run.status }, {
        $set: { status: "processing", leaseToken: token, leaseUntil: new Date(+now + this.config.leaseMs), startedAt: now, updatedAt: now,
          inputSnapshot: run.inputSnapshot || this.inputFor(sub),
          priceConsent: run.priceConsent || { confirmedTotal: sub.confirmedTotal, maximumTotal: sub.maximumTotal, priceIncreasePercent: sub.priceIncreasePercent }, },
        $inc: { attempts: 1 }, $push: { audit: this.log("processing") },
      }, { session, returnDocument: "after" });
      await this.notice(sub, "upcoming", { run, session, key: `${run.idempotencyKey}:upcoming` });
      return claimed;
    });
  }

  async finishOrder(sub, run, result, session) {
    await this.repo.runs.updateOne({ _id: run._id }, { $set: { status: "order_created", orderId: result.order._id,
      ...(result.payment?.method === "paypal" ? { paymentRequestId: result.payment.idempotency_key } : {}), completedAt: this.now(), updatedAt: this.now() },
      $unset: { leaseToken: "", leaseUntil: "", lastError: "", nextRetryAt: "" }, $push: { audit: this.log("order_created", sub, { orderId: result.order._id }) } }, { session });
    await this.refresh(sub, session);
    await this.notice(sub, "order_created", { run: { ...run, orderId: result.order._id }, session, key: `${run.idempotencyKey}:order_created` });
  }

  async execute(run) {
    try {
      return await this.repo.transaction(async session => {
        const current = await this.repo.runs.findOne({ _id: run._id, status: "processing", leaseToken: run.leaseToken }, { session });
        if (!current) return { status: "unclaimed" };
        const sub = await this.repo.subscriptions.findOne({ _id: run.subscriptionId }, { session });
        await this.repo.subscriptions.updateOne({ _id: sub._id }, { $inc: { version: 1 } }, { session });
        const existingOrder = await this.orders.Order.findOne({ subscriptionRunId: run._id }, { session });
        if (existingOrder) {
          await this.finishOrder(sub, current, { order: existingOrder }, session);
          return { status: "order_created", recovered: true };
        }
        if (sub.status !== "active") {
          await this.repo.runs.updateOne({ _id: run._id }, { $set: { status: sub.status === "cancelled" ? "skipped" : "scheduled" }, $unset: { leaseToken: "", leaseUntil: "" } }, { session });
          return { status: sub.status };
        }
        const input = current.inputSnapshot;
        const plan = await this.checkout(sub.userId, input, session);
        const status = plan.total_price > this.ceiling(sub, current) ? "pending_confirmation" : input.paymentMethod === "paypal" ? "pending_payment" : null;
        if (status) {
          await this.repo.runs.updateOne({ _id: run._id }, { $set: { status, estimatedTotal: plan.total_price, updatedAt: this.now() }, $unset: { leaseToken: "", leaseUntil: "" }, $push: { audit: this.log(status) } }, { session });
          await this.notice(sub, status, { run, session, key: `${run.idempotencyKey}:${status}` });
          return { status };
        }
        const result = await this.orders.createFromItems({
          userId: sub.userId, addressId: input.addressId, shippingMethodId: input.shippingMethodId, discountCode: input.discountCode,
          payment_method: "cod", sourceItems: input.items, idempotencyKey: run.idempotencyKey,
          subscriptionContext: { subscriptionId: sub._id, subscriptionRunId: run._id, subscriptionOccurrence: run.occurrenceNumber, subscriptionNotes: input.notes },
          maximumTotal: this.ceiling(sub, current), session, enqueueAdminNotification: true,
        });
        if (this.fault) await this.fault("after-order", result);
        await this.finishOrder(sub, current, result, session);
        return { status: "order_created", orderId: result.order._id };
      });
    } catch (error) {
      // A failed finalization rolls the order, payment, batch deduction and outbox back together.
      await this.repo.transaction(async session => {
        const current = await this.repo.runs.findOne({ _id: run._id, status: "processing", leaseToken: run.leaseToken }, { session });
        if (!current) return;
        const sub = await this.repo.subscriptions.findOne({ _id: run.subscriptionId }, { session });
        const reason = error.statusCode && error.statusCode < 500 ? error.message : "Lỗi xử lý tạm thời; hệ thống sẽ thử lại theo chính sách";
        await this.repo.runs.updateOne({ _id: run._id, leaseToken: run.leaseToken }, { $set: { status: "failed", lastError: reason, errorCode: String(error.code || "SUBSCRIPTION_PROCESSING_FAILED"),
          nextRetryAt: new Date(+this.now() + this.config.retryMs * 2 ** Math.min(current.attempts - 1, 5)), updatedAt: this.now() },
          $unset: { leaseToken: "", leaseUntil: "" }, $push: { audit: this.log("failed", sub, { reason }) } }, { session });
        await this.notice(sub, "failed", { run, reason, session, key: `${run.idempotencyKey}:failed` });
      });
      return { status: "failed" };
    }
  }

  async processRun(id, options) {
    this.assertEnabled();
    const run = await this.claim(id, options);
    return run ? this.execute(run) : { status: "not_due" };
  }

  async tick() {
    this.assertEnabled();
    const now = this.now();
    const activeIds = await this.repo.subscriptions.distinct("_id", { status: "active" });
    const runs = await this.repo.runs.find({ subscriptionId: { $in: activeIds }, $or: [
      { status: "scheduled", processAt: { $lte: now } },
      { status: "failed", attempts: { $lt: this.config.maxAttempts }, nextRetryAt: { $lte: now } },
      { status: "processing", leaseUntil: { $lte: now } },
    ] }).sort({ processAt: 1 }).limit(100).toArray();
    const results = [];
    for (const run of runs) results.push(await this.processRun(run._id));
    return results;
  }

  async adminRunAction(id, action, reason, actorId) {
    if (!reason?.trim()) throw new ApiError(400, "Cần ghi rõ lý do thao tác");
    return this.repo.transaction(async session => {
      const run = await this.repo.runs.findOne({ _id: objectId(id) }, { session });
      if (!run) throw new ApiError(404, "Không tìm thấy kỳ giao");
      const sub = await this.repo.subscriptions.findOne({ _id: run.subscriptionId }, { session });
      if (sub.status !== "active" || run.orderId || !["failed", "pending_confirmation", "pending_payment"].includes(run.status)) throw new ApiError(409, "Kỳ này không thể xử lý thủ công");
      if (action === "retry" && run.status !== "failed") throw new ApiError(409, "Chỉ thử lại kỳ thất bại; giá thay đổi cần khách xác nhận");
      const status = action === "skip" ? "skipped" : action === "confirm" ? "pending_confirmation" : "failed";
      await this.repo.subscriptions.updateOne({ _id: sub._id }, { $inc: { version: 1 } }, { session });
      await this.repo.runs.updateOne({ _id: run._id }, { $set: { status, reason: reason.trim(), ...(action === "retry" ? { attempts: 0, nextRetryAt: this.now() } : {}), updatedAt: this.now() },
        $push: { audit: this.log(action, sub, { reason: reason.trim(), ...(actorId ? { actorId: objectId(actorId) } : {}) }) } }, { session });
      await this.refresh(sub, session);
      await this.notice(sub, action === "confirm" ? "pending_confirmation" : action === "skip" ? "skipped" : "retry", { run, reason: reason.trim(), session, key: `${run.idempotencyKey}:admin:${action}:${sub.version}` });
    });
  }

  async ownedRun(id, userId, session) {
    const run = await this.repo.runs.findOne({ _id: objectId(id), userId: objectId(userId) }, { session });
    if (!run) throw new ApiError(404, "Không tìm thấy kỳ giao");
    const sub = await this.repo.owned(run.subscriptionId, userId, { session });
    return { run, sub };
  }

  async runQuote(id, userId, maximumTotal) {
    const { run, sub } = await this.ownedRun(id, userId);
    if (sub.status !== "active" || !["pending_confirmation", "pending_payment"].includes(run.status) || run.orderId) throw new ApiError(409, "Kỳ giao không còn chờ xác nhận");
    const input = { ...run.inputSnapshot, maximumTotal };
    const plan = await this.checkout(userId, input);
    const previousTotal = run.approvedTotal ?? run.priceConsent?.confirmedTotal ?? sub.confirmedTotal;
    return { previousTotal, estimatedTotal: plan.total_price, difference: plan.total_price - previousTotal,
      differencePercent: previousTotal > 0 ? (plan.total_price - previousTotal) * 100 / previousTotal : null,
      quoteToken: this.quoteToken(userId, { ...input, runId: String(run._id) }, plan.total_price) };
  }

  async confirmRun(id, userId, payload) {
    this.assertEnabled();
    const existing = await this.ownedRun(id, userId);
    if (existing.run.orderId) return { status: existing.run.status, orderId: existing.run.orderId, alreadyProcessed: true };
    await this.repo.transaction(async session => {
      const { run, sub } = await this.ownedRun(id, userId, session);
      if (sub.status !== "active" || run.orderId || !["pending_confirmation", "pending_payment"].includes(run.status)) throw new ApiError(409, "Kỳ giao không còn chờ xác nhận");
      const input = { ...run.inputSnapshot, maximumTotal: payload.maximumTotal };
      const plan = await this.checkout(userId, input, session);
      this.verifyQuote(userId, { ...input, runId: String(run._id), quoteToken: payload.quoteToken }, plan.total_price);
      if (!payload.consent || payload.maximumTotal < plan.total_price) throw new ApiError(400, "Cần đồng ý giá và giới hạn đủ cho kỳ này");
      await this.repo.subscriptions.updateOne({ _id: sub._id }, { $inc: { version: 1 } }, { session });
      await this.repo.runs.updateOne({ _id: run._id }, { $set: { approvedTotal: plan.total_price, approvedMaximum: payload.maximumTotal, approvedAt: this.now(), status: "pending_payment", updatedAt: this.now() },
        $push: { audit: this.log("price_confirmed", sub, { actorId: objectId(userId), confirmedTotal: plan.total_price, maximumTotal: payload.maximumTotal,
          quoteDigest: crypto.createHash("sha256").update(payload.quoteToken).digest("hex") }) } }, { session });
      if (input.paymentMethod === "paypal") await this.notice(sub, "pending_payment", { run, session, key: `${run.idempotencyKey}:pending_payment` });
    });
    const { run } = await this.ownedRun(id, userId);
    if (run.inputSnapshot.paymentMethod === "cod") return this.processRun(id, { manual: true });
    return { status: "pending_payment" };
  }

  async rejectRun(id, userId, reason = "Khách hàng không đồng ý giá kỳ này") {
    await this.repo.transaction(async session => {
      const { run, sub } = await this.ownedRun(id, userId, session);
      if (run.status === "skipped" && run.declinedAt) return;
      if (sub.status !== "active" || run.orderId || !["pending_confirmation", "pending_payment"].includes(run.status)) throw new ApiError(409, "Kỳ này không còn có thể từ chối giá");
      await this.repo.subscriptions.updateOne({ _id: sub._id }, { $inc: { version: 1 } }, { session });
      await this.repo.runs.updateOne({ _id: run._id }, { $set: { status: "skipped", reason, declinedAt: this.now(), updatedAt: this.now() },
        $push: { audit: this.log("price_declined", sub, { actorId: objectId(userId), reason }) } }, { session });
      await this.refresh(sub, session);
      await this.notice(sub, "skipped", { run, reason, session, key: `${run.idempotencyKey}:price_declined` });
    });
    return { status: "skipped" };
  }

  async paypalContext(id, userId) {
    this.assertEnabled();
    const { run, sub } = await this.ownedRun(id, userId);
    if (sub.status !== "active" || run.status !== "pending_payment" || run.orderId || run.inputSnapshot.paymentMethod !== "paypal") throw new ApiError(409, "Kỳ giao không còn chờ thanh toán");
    const plan = await this.checkout(userId, run.inputSnapshot);
    if (plan.total_price > this.ceiling(sub, run)) throw new ApiError(409, "Giá vượt giới hạn; hãy xác nhận lại giá của kỳ này");
    return { run, sub, input: run.inputSnapshot, plan };
  }

  async paypalOrderHooks(id, userId) {
    const { run, sub } = await this.ownedRun(id, userId);
    return {
      sourceItems: run.inputSnapshot.items,
      maximumTotal: this.ceiling(sub, run),
      subscriptionContext: { subscriptionId: sub._id, subscriptionRunId: run._id, subscriptionOccurrence: run.occurrenceNumber, subscriptionNotes: run.inputSnapshot.notes },
      beforeCreate: async session => {
        const fresh = await this.repo.runs.findOne({ _id: run._id, status: "pending_payment", orderId: { $exists: false } }, { session });
        const active = await this.repo.subscriptions.findOne({ _id: sub._id, status: "active" }, { session });
        if (!fresh || !active) throw new ApiError(409, "Đăng ký hoặc kỳ thanh toán đã thay đổi");
        await this.validateProducts(fresh.inputSnapshot.items, session);
        await this.repo.subscriptions.updateOne({ _id: sub._id }, { $inc: { version: 1 } }, { session });
      },
      afterCreate: (result, session) => this.finishOrder(sub, run, result, session),
    };
  }
}

module.exports = SubscriptionsService;
