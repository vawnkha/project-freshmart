const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const OrdersService = require("../services/orders.service");
const { sendInvoiceEmail } = require("../utils/mailer.util");
const { notifyAdmin } = require("../utils/notify-admin.util");
const authMiddleware = require("../middlewares/auth.middleware");

exports.create = async (req, res, next) => {
  try {
    const { user_id, address_id, payment_method } = req.body;

    if (!user_id || !address_id) {
      return next(new ApiError(400, "user_id và address_id là bắt buộc"));
    }

    const service = new OrdersService(MongoDB.client);

    const rs = await service.createFromCart({
      userId: user_id,
      addressId: address_id,
      payment_method: payment_method || "cash",
    });

    if (rs?.error || !rs?.ok || !rs?.order) {
      return next(new ApiError(400, rs?.error || "Không thể tạo đơn hàng"));
    }

    const order = rs.order;

    await notifyAdmin({
      type: "order",
      title: "Có đơn hàng mới",
      content: `Có đơn đặt hàng mới với mã ${order._id}`,
      data: {
        order_id: String(order._id),
        user_id: String(order.user_id),
        total_price: order.total_price,
        status: order.status,
        payment_method: rs.payment?.method || payment_method || "cash",
        payment_status: rs.payment?.status || "pending",
      },
    });

    return res.send({
      message: "Đặt hàng thành công",
      data: rs,
    });
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi khi đặt hàng"));
  }
};

exports.findAll = async (req, res, next) => {
  try {
    const service = new OrdersService(MongoDB.client);
    const docs = await service.findAll();

    return res.send(docs);
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi lấy tất cả đơn hàng"));
  }
};

exports.findByUser = async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return next(new ApiError(400, "userId là bắt buộc"));

    const service = new OrdersService(MongoDB.client);
    const docs = await service.findByUser(userId);

    return res.send(docs);
  } catch (error) {
    return next(
      new ApiError(500, error.message || "Lỗi lấy danh sách đơn hàng"),
    );
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = new OrdersService(MongoDB.client);
    const doc = await service.getOrderDetail(id);

    if (!doc) {
      return next(new ApiError(404, "Đơn hàng không tồn tại"));
    }

    if (!authMiddleware.canAccessOwner(req, doc.user_id, "order:read:any")) {
      return next(new ApiError(403, "Bạn không có quyền xem đơn hàng này"));
    }

    return res.send(doc);
  } catch (error) {
    return next(
      new ApiError(500, error.message || "Lỗi lấy chi tiết đơn hàng"),
    );
  }
};
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return next(new ApiError(400, "status là bắt buộc"));
    }

    const service = new OrdersService(MongoDB.client);
    const doc = await service.pushStatus(id, status, note || "");

    if (!doc) {
      return next(new ApiError(404, "Đơn hàng không tồn tại"));
    }

    return res.send(doc);
  } catch (error) {
    return next(
      new ApiError(500, error.message || "Lỗi cập nhật trạng thái đơn hàng"),
    );
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = new OrdersService(MongoDB.client);
    const current = await service.getOrderDetail(id);

    if (!current) {
      return next(new ApiError(404, "Đơn hàng không tồn tại"));
    }

    if (!authMiddleware.canAccessOwner(req, current.user_id, "order:update")) {
      return next(new ApiError(403, "Bạn không có quyền hủy đơn hàng này"));
    }

    if (current.status !== "pending") {
      return next(new ApiError(400, "Chỉ được hủy đơn đang chờ xác nhận"));
    }

    const doc = await service.cancelOrder(
      id,
      req.currentUser || req.user,
      "Người dùng hủy đơn hàng",
    );

    return res.send(doc);
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi hủy đơn hàng"));
  }
};

exports.complete = async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = new OrdersService(MongoDB.client);
    const current = await service.getOrderDetail(id);

    if (!current) {
      return next(new ApiError(404, "Đơn hàng không tồn tại"));
    }

    if (!authMiddleware.canAccessOwner(req, current.user_id, "order:update")) {
      return next(
        new ApiError(403, "Bạn không có quyền cập nhật đơn hàng này"),
      );
    }

    if (current.status !== "shipping") {
      return next(new ApiError(400, "Chỉ được hủy đơn đang chờ xác nhận"));
    }

    const doc = await service.pushStatus(
      id,
      "completed",
      "Xác nhận đã nhận đơn hàng",
    );

    return res.send(doc);
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi hủy đơn hàng"));
  }
};
exports.sendInvoice = async (req, res, next) => {
  try {
    const ordersService = new OrdersService(MongoDB.client);

    const order = await ordersService.getOrderDetail(req.params.id);

    if (!order) {
      return next(new ApiError(404, "Không tìm thấy đơn hàng"));
    }

    if (order.invoice_sent) {
      return next(new ApiError(400, "Hóa đơn đã được gửi trước đó"));
    }

    const customerEmail =
      order.user?.email || order.shipping_address?.email || null;

    if (!customerEmail) {
      return next(new ApiError(400, "Không có email khách hàng"));
    }

    const customerName =
      order.user?.name || order.shipping_address?.fullName || "quý khách";

    await sendInvoiceEmail({
      to: customerEmail,
      customerName,
      order,
    });

    await ordersService.Order.updateOne(
      { _id: order._id },
      {
        $set: {
          invoice_sent: true,
          invoice_sent_at: new Date(),
        },
      },
    );

    return res.send({
      message: "Đã gửi hóa đơn",
    });
  } catch (error) {
    return next(new ApiError(500, error.message));
  }
};
