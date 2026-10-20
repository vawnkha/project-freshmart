const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const OrdersService = require("../services/orders.service");
const authMiddleware = require("../middlewares/auth.middleware");
const PAYMENT_METHODS = require("../constants/payment-methods");

exports.create = async (req, res, next) => {
  try {
    const { address_id, payment_method, shippingMethodId, discountCode } =
      req.body;
    const user_id = req.user?.id;

    if (!user_id || !address_id) {
      return next(new ApiError(400, "user_id và address_id là bắt buộc"));
    }

    const service = new OrdersService(MongoDB.client);

    const rs = await service.createFromCart({
      userId: user_id,
      addressId: address_id,
      payment_method: payment_method || PAYMENT_METHODS.COD,
      shippingMethodId,
      discountCode,
      enqueueAdminNotification: true,
    });

    if (rs?.error || !rs?.ok || !rs?.order) {
      return next(new ApiError(400, rs?.error || "Không thể tạo đơn hàng"));
    }

    const order = rs.order;

    return res.send({
      message: "Đặt hàng thành công",
      data: rs,
    });
  } catch (error) {
    return next(
      error?.statusCode
        ? error
        : new ApiError(500, error.message || "Lỗi khi đặt hàng"),
    );
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
    const doc = await service.transitionStatus(
      id,
      status,
      req.user,
      note || "",
    );

    if (!doc) {
      return next(new ApiError(404, "Đơn hàng không tồn tại"));
    }

    return res.send(doc);
  } catch (error) {
    return next(
      error?.statusCode
        ? error
        : new ApiError(500, "Lỗi cập nhật trạng thái đơn hàng"),
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

    const doc = await service.cancelOrder(
      id,
      req.user,
      req.body.reason || "Người dùng hủy đơn hàng",
    );

    return res.send(doc);
  } catch (error) {
    return next(
      error?.statusCode ? error : new ApiError(500, "Lỗi hủy đơn hàng"),
    );
  }
};

exports.returnReceived = async (req, res, next) => {
  try {
    const result = await new OrdersService(MongoDB.client).returnReceivedOrder(req.params.id, req.user, req.body.reason);
    if (!result) throw new ApiError(404, "Đơn hàng không tồn tại");
    return res.send(result);
  } catch (error) { return next(error); }
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

    const doc = await service.transitionStatus(
      id,
      "completed",
      req.user,
      "Xác nhận đã nhận đơn hàng",
    );

    return res.send(doc);
  } catch (error) {
    return next(
      error?.statusCode ? error : new ApiError(500, "Lỗi cập nhật đơn hàng"),
    );
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

    await ordersService.queueInvoiceEmail(order, customerEmail, customerName);

    return res.status(202).send({
      message: "Đã đưa hóa đơn vào hàng đợi gửi",
      queued: true,
    });
  } catch (error) {
    return next(new ApiError(500, error.message));
  }
};
