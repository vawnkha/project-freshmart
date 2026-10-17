const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const ContactsService = require("../services/contacts.service");

exports.create = async (req, res, next) => {
  try {
    const { name, email, subject, content } = req.body;

    if (!name || !email || !subject || !content) {
      return next(new ApiError(400, "Vui lòng nhập đầy đủ thông tin liên hệ"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new ApiError(400, "Email không hợp lệ"));
    }

    const contactsService = new ContactsService(MongoDB.client);
    const document = await contactsService.create({
      name,
      email,
      subject,
      content,
      status: "pending",
    });

    return res.send({
      message: "Gửi liên hệ thành công",
      data: document,
    });
  } catch (error) {
    return next(new ApiError(500, "Đã xảy ra lỗi khi gửi thông tin liên hệ"));
  }
};

exports.findAll = async (_req, res, next) => {
  try {
    const contactsService = new ContactsService(MongoDB.client);
    const documents = await contactsService.find({});
    return res.send(documents);
  } catch (error) {
    return next(new ApiError(500, "Đã xảy ra lỗi khi lấy danh sách liên hệ"));
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const contactsService = new ContactsService(MongoDB.client);
    const document = await contactsService.findById(req.params.id);

    if (!document) {
      return next(new ApiError(404, "Không tìm thấy liên hệ"));
    }

    return res.send(document);
  } catch (error) {
    return next(new ApiError(500, "Lỗi khi lấy chi tiết liên hệ"));
  }
};

exports.reply = async (req, res, next) => {
  try {
    const { admin_reply } = req.body;

    if (!admin_reply || !admin_reply.trim()) {
      return next(new ApiError(400, "Nội dung phản hồi không được để trống"));
    }

    const contactsService = new ContactsService(MongoDB.client);

    const contact = await contactsService.findById(req.params.id);
    if (!contact) {
      return next(new ApiError(404, "Không tìm thấy liên hệ"));
    }

    const updated = await contactsService.reply(req.params.id, {
      admin_reply,
    });
    if (!updated) {
      return next(new ApiError(404, "Không tìm thấy liên hệ"));
    }

    return res.send({
      message: "Đã phản hồi; email đang được gửi",
      data: updated,
      mailSent: false,
      mailQueued: true,
      mailError: "",
    });
  } catch (error) {
    return next(new ApiError(500, "Lỗi khi phản hồi liên hệ"));
  }
};

exports.delete = async (req, res, next) => {
  try {
    const contactsService = new ContactsService(MongoDB.client);
    const document = await contactsService.delete(req.params.id);

    if (!document) {
      return next(new ApiError(404, "Không tìm thấy liên hệ"));
    }

    return res.send({ message: "Xóa liên hệ thành công" });
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(500, "Không thể xóa liên hệ"));
  }
};

exports.deleteAll = async (_req, res, next) => {
  try {
    const contactsService = new ContactsService(MongoDB.client);
    const deletedCount = await contactsService.deleteAll();

    return res.send({
      message: `${deletedCount} liên hệ đã được xóa`,
    });
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(500, "Không thể xóa tất cả liên hệ"));
  }
};
