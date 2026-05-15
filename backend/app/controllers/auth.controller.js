const MongoDB = require("../utils/mongodb.util");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ApiError = require("../api-error");
const UserService = require("../services/users.service");
const RbacService = require("../services/rbac.service");
const { sendResetPasswordEmail } = require("../utils/mailer.util");
const { sanitizeUser } = require("../utils/user.util");

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new ApiError(400, "Email và mật khẩu là bắt buộc"));
    }

    const userService = new UserService(MongoDB.client);
    const user = await userService.findByEmail(email);
    if (!user) {
      return next(new ApiError(401, "Email hoặc mật khẩu không đúng"));
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return next(new ApiError(401, "Email hoặc mật khẩu không đúng"));
    }
    if (user.status === "pending") {
      return next(new ApiError(403, "Tài khoản chưa được kích hoạt"));
    }
    if (user.status === "blocked") {
      return next(
        new ApiError(
          403,
          "Tài khoản của bạn đã bị khóa. vui lòng liên hệ cửa hàng để được hỗ trợ",
        ),
      );
    }
    const rbacService = new RbacService(MongoDB.client);
    const authContext = await rbacService.getAuthContextForUser(user);
    const token = jwt.sign(
      {
        id: String(user._id),
        role_id: authContext.role_id,
        role: authContext.role,
        permissions: authContext.permissions,
      },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.send({
      message: "Đăng nhập thành công",
      accessToken: token,
      tokenType: "Bearer",
      expiresIn: JWT_EXPIRES_IN,
      user: sanitizeUser({
        ...user,
        role_id: authContext.role_id,
        role: authContext.role,
        roleName: authContext.roleName,
        permissions: authContext.permissions,
      }),
    });
  } catch (error) {
    return next(new ApiError(500, "Lỗi đăng nhập"));
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    if (!userId || !oldPassword || !newPassword) {
      return next(new ApiError(400, "Mật khẩu cũ và mật khẩu mới là bắt buộc"));
    }
    const userService = new UserService(MongoDB.client);
    const user = await userService.findById(userId);
    if (!user) {
      return next(new ApiError(404, "Người dùng không tồn tại"));
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return next(new ApiError(401, "Mật khẩu cũ không đúng"));
    }
    await userService.update(userId, { password: newPassword });
    return res.send({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    return next(new ApiError(500, "Lỗi đổi mật khẩu"));
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new ApiError(400, "Email không được để trống"));

    const userService = new UserService(MongoDB.client);

    const info = await userService.setResetPasswordTokenByEmail(email, 15);
    if (!info) {
      return next(new ApiError(404, "Người dùng với email này không tồn tại"));
    }

    const frontendBaseUrl =
      process.env.FRONTEND_BASE_URL || "http://localhost:3001";
    const resetLink = `${frontendBaseUrl}/reset-password/${info.userId}/${info.rawToken}`;

    await sendResetPasswordEmail({
      to: info.email,
      name: info.name,
      resetLink,
      expiresMinutes: 15,
    });
    return res.send({
      message: "Yêu cầu đặt lại mật khẩu đã được gửi, vui lòng kiểm tra email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return next(
      new ApiError(500, error.message || "Lỗi yêu cầu đặt lại mật khẩu"),
    );
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { userId, token } = req.params;
    const { newPassword } = req.body;
    if (!token || !newPassword) {
      return next(new ApiError(400, "Token và mật khẩu mới là bắt buộc"));
    }

    const userService = new UserService(MongoDB.client);

    const updated = await userService.resetPasswordByToken(
      userId,
      token,
      newPassword,
    );
    if (!updated) {
      return next(
        new ApiError(
          400,
          "Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
        ),
      );
    }

    return res.send({ message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    return next(new ApiError(500, "Lỗi đặt lại mật khẩu"));
  }
};
