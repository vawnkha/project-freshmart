const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const NotificationsService = require("../services/notifications.service");

exports.create = async (req, res, next) => {
  try {
    const { type, title, content, data, is_read } = req.body;

    if (!type || !title || !content) {
      return next(new ApiError(400, "Thiếu thông tin tạo thông báo"));
    }

    const notificationsService = new NotificationsService(MongoDB.client);
    const document = await notificationsService.create({
      type,
      title,
      content,
      data,
      is_read,
    });

    return res.send({
      message: "Tạo thông báo thành công",
      data: document,
    });
  } catch (error) {
    return next(new ApiError(500, "Không thể tạo thông báo"));
  }
};

exports.findAll = async (req, res, next) => {
  try {
    const notificationsService = new NotificationsService(MongoDB.client);
    const filter = notificationsService.buildFilter(req.query);

    const result = await notificationsService.find(filter);

    return res.send(result);
  } catch (error) {
    return next(new ApiError(500, "Không thể tải danh sách thông báo"));
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const notificationsService = new NotificationsService(MongoDB.client);
    const document = await notificationsService.findById(req.params.id);

    if (!document) {
      return next(new ApiError(404, "Không tìm thấy thông báo"));
    }

    return res.send(document);
  } catch (error) {
    return next(new ApiError(500, "Không thể tải chi tiết thông báo"));
  }
};

exports.update = async (req, res, next) => {
  try {
    const notificationsService = new NotificationsService(MongoDB.client);
    const document = await notificationsService.update(req.params.id, req.body);

    if (!document) {
      return next(new ApiError(404, "Không tìm thấy thông báo"));
    }

    return res.send({
      message: "Cập nhật thông báo thành công",
      data: document,
    });
  } catch (error) {
    return next(new ApiError(500, "Không thể cập nhật thông báo"));
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const notificationsService = new NotificationsService(MongoDB.client);
    const document = await notificationsService.markAsRead(req.params.id);

    if (!document) {
      return next(new ApiError(404, "Không tìm thấy thông báo"));
    }

    return res.send({
      message: "Đã đánh dấu đã đọc",
      data: document,
    });
  } catch (error) {
    return next(new ApiError(500, "Không thể cập nhật trạng thái thông báo"));
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const notificationsService = new NotificationsService(MongoDB.client);
    const filter = notificationsService.buildFilter(req.query);
    const modifiedCount = await notificationsService.markAllAsRead(filter);

    return res.send({
      message: `Đã đánh dấu ${modifiedCount} thông báo là đã đọc`,
    });
  } catch (error) {
    return next(new ApiError(500, "Không thể đánh dấu tất cả thông báo"));
  }
};

exports.countUnread = async (_req, res, next) => {
  try {
    const notificationsService = new NotificationsService(MongoDB.client);
    const unread = await notificationsService.countUnread();
    return res.send({ unread });
  } catch (error) {
    return next(new ApiError(500, "Không thể đếm thông báo chưa đọc"));
  }
};

exports.delete = async (req, res, next) => {
  try {
    const notificationsService = new NotificationsService(MongoDB.client);
    const document = await notificationsService.delete(req.params.id);

    if (!document) {
      return next(new ApiError(404, "Không tìm thấy thông báo"));
    }

    return res.send({ message: "Xóa thông báo thành công" });
  } catch (error) {
    return next(new ApiError(500, "Không thể xóa thông báo"));
  }
};

exports.deleteMany = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) {
      return next(new ApiError(400, "Danh sách ids không hợp lệ"));
    }

    const notificationsService = new NotificationsService(MongoDB.client);
    const deletedCount = await notificationsService.deleteManyByIds(ids);

    return res.send({
      message: `Đã xóa ${deletedCount} thông báo`,
    });
  } catch (error) {
    return next(new ApiError(500, "Không thể xóa nhiều thông báo"));
  }
};

exports.deleteAll = async (req, res, next) => {
  try {
    const notificationsService = new NotificationsService(MongoDB.client);
    const filter = notificationsService.buildFilter(req.query);
    const deletedCount = await notificationsService.deleteAll(filter);

    return res.send({
      message: `Đã xóa ${deletedCount} thông báo`,
    });
  } catch (error) {
    return next(new ApiError(500, "Không thể xóa tất cả thông báo"));
  }
};
