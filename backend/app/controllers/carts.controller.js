const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const CartsService = require("../services/carts.service");

exports.getMyCart = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const cartService = new CartsService(MongoDB.client);
    const cart = await cartService.getOrCreate(userId);
    return res.send(cart);
  } catch (error) {
    return next(new ApiError(500, error.message || "Lỗi lấy giỏ hàng"));
  }
};

exports.getMyCartDetailed = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const cartService = new CartsService(MongoDB.client);
    const result = await cartService.getDetailedCart(userId);
    return res.send(result);
  } catch (error) {
    return next(
      new ApiError(500, error.message || "Lỗi lấy giỏ hàng chi tiết"),
    );
  }
};

exports.addItem = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const productId = req.body.product_id || req.body.productId;
    const { quantity } = req.body;
    if (!productId) return next(new ApiError(400, "product_id là bắt buộc"));

    const cartService = new CartsService(MongoDB.client);
    const result = await cartService.addItem(userId, productId, quantity);
    if (result.error) return next(new ApiError(400, result.error));

    return res.send({ message: "Thêm sản phẩm vào giỏ hàng thành công" });
  } catch (error) {
    return next(
      new ApiError(500, error.message || "Lỗi thêm sản phẩm vào giỏ hàng"),
    );
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const { userId, productId } = req.params;
    const { quantity } = req.body;
    const cartService = new CartsService(MongoDB.client);
    const result = await cartService.updateItem(userId, productId, quantity);
    if (result.error) return next(new ApiError(400, result.error));

    return res.send({
      message: "Cập nhật sản phẩm trong giỏ hàng thành công",
    });
  } catch (error) {
    return next(
      new ApiError(
        500,
        error.message || "Lỗi cập nhật sản phẩm trong giỏ hàng",
      ),
    );
  }
};

exports.removeItem = async (req, res, next) => {
  try {
    const { userId, productId } = req.params;
    const cartService = new CartsService(MongoDB.client);
    const result = await cartService.removeItem(userId, productId);
    if (result.error) return next(new ApiError(400, result.error));

    return res.send({ message: "Xóa sản phẩm khỏi giỏ hàng thành công" });
  } catch (error) {
    return next(
      new ApiError(500, error.message || "Lỗi xóa sản phẩm khỏi giỏ hàng"),
    );
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const cartService = new CartsService(MongoDB.client);
    const result = await cartService.clearCart(userId);
    if (result.error) return next(new ApiError(400, result.error));

    return res.send({
      message: "Xóa tất cả sản phẩm khỏi giỏ hàng thành công",
    });
  } catch (error) {
    return next(
      new ApiError(
        500,
        error.message || "Lỗi xóa tất cả sản phẩm khỏi giỏ hàng",
      ),
    );
  }
};
