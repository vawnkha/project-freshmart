const MongDB = require("../utils/mongodb.util");
const AddressService = require("../services/addresses.service");
const ApiError = require("../api-error");
const authMiddleware = require("../middlewares/auth.middleware");

exports.create = async (req, res, next) => {
  try {
    const addressService = new AddressService(MongDB.client);
    const result = await addressService.create(req.body);
    if (result.error) {
      return next(new ApiError(400, result.error));
    }
    return res.status(201).send({
      message: "Tạo địa chỉ thành công",
      data: result,
    });
  } catch (error) {
    return next(new ApiError(400, error.message || "Lỗi tạo địa chỉ"));
  }
};

exports.findByUser = async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return next(new ApiError(400, "userId là bắt buộc"));
    }
    const addressService = new AddressService(MongDB.client);
    const result = await addressService.findByUserId(userId);
    return res.send(result);
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi lấy địa chỉ"));
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const addressService = new AddressService(MongDB.client);
    const existed = await addressService.findById(id);

    if (!existed) {
      return next(new ApiError(404, "Địa chỉ không tồn tại"));
    }

    if (
      !authMiddleware.canAccessOwner(req, existed.user_id, "address:manage:any")
    ) {
      return next(new ApiError(403, "Bạn không có quyền cập nhật địa chỉ này"));
    }

    const result = await addressService.update(id, req.body);
    return res.send({
      message: "Cập nhật địa chỉ thành công",
      data: result,
    });
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi cập nhật địa chỉ"));
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const addressService = new AddressService(MongDB.client);
    const existed = await addressService.findById(id);

    if (!existed) {
      return next(new ApiError(404, "Địa chỉ không tồn tại"));
    }

    if (
      !authMiddleware.canAccessOwner(req, existed.user_id, "address:manage:any")
    ) {
      return next(new ApiError(403, "Bạn không có quyền xóa địa chỉ này"));
    }

    const result = await addressService.delete(id);
    return res.send({
      message: "Xóa địa chỉ thành công",
    });
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi xóa địa chỉ"));
  }
};
