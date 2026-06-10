const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const RbacService = require("../services/rbac.service");
const { hasPermission } = require("../config/permissions");

function getJwtSecret() {
  return process.env.JWT_SECRET || "secretkey";
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.split(" ")[1];
}

function isSameUser(currentUserId, targetUserId) {
  return Boolean(
    currentUserId &&
    targetUserId &&
    String(currentUserId) === String(targetUserId),
  );
}

const authJWT = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return next(new ApiError(401, "Không có token"));
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded?.id;
    const objectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;

    if (!objectId) {
      return next(new ApiError(401, "Token không hợp lệ"));
    }

    const user = await MongoDB.client
      .db()
      .collection("users")
      .findOne({ _id: objectId });

    if (!user) {
      return next(new ApiError(401, "Tài khoản không tồn tại"));
    }

    if (["pending", "blocked"].includes(user.status)) {
      return next(new ApiError(403, "Tài khoản chưa được phép truy cập"));
    }

    const rbacService = new RbacService(MongoDB.client);
    const authContext = await rbacService.getAuthContextForUser(user);

    req.auth = decoded;
    req.currentUser = user;
    req.user = authContext;
    next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Token đã hết hạn"
        : "Token không hợp lệ";
    return next(new ApiError(401, message));
  }
};

const optionalAuthJWT = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded?.id;
    const objectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    if (!objectId) return next();

    const user = await MongoDB.client
      .db()
      .collection("users")
      .findOne({ _id: objectId });

    if (!user || ["pending", "blocked"].includes(user.status)) {
      return next();
    }

    const rbacService = new RbacService(MongoDB.client);
    const authContext = await rbacService.getAuthContextForUser(user);

    req.auth = decoded;
    req.currentUser = user;
    req.user = authContext;
    return next();
  } catch (_) {
    return next();
  }
};

function authorizePermissions(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Vui lòng đăng nhập"));
    }

    if (hasPermission(req.user, requiredPermissions)) {
      return next();
    }

    return next(new ApiError(403, "Bạn không có quyền thực hiện thao tác này"));
  };
}

function authorizeRoles(...roles) {
  const acceptedRoles = roles.map((role) => String(role).toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Vui lòng đăng nhập"));
    }

    if (acceptedRoles.includes(req.user.role)) {
      return next();
    }

    return next(new ApiError(403, "Bạn không có quyền thực hiện thao tác này"));
  };
}

function canAccessOwner(req, ownerId, ...fallbackPermissions) {
  if (!req.user) return false;
  if (isSameUser(req.user.id, ownerId)) return true;
  if (!fallbackPermissions.length) return false;
  return hasPermission(req.user, fallbackPermissions);
}

function authorizeOwnerOrPermissions(ownerResolver, ...fallbackPermissions) {
  return (req, res, next) => {
    const ownerId =
      typeof ownerResolver === "function" ? ownerResolver(req) : ownerResolver;

    if (!ownerId) {
      return next(new ApiError(400, "Thiếu thông tin chủ sở hữu dữ liệu"));
    }

    if (canAccessOwner(req, ownerId, ...fallbackPermissions)) {
      return next();
    }

    return next(new ApiError(403, "Bạn không có quyền truy cập dữ liệu này"));
  };
}

authJWT.getJwtSecret = getJwtSecret;
authJWT.authorizePermissions = authorizePermissions;
authJWT.authorizeRoles = authorizeRoles;
authJWT.authorizeOwnerOrPermissions = authorizeOwnerOrPermissions;
authJWT.canAccessOwner = canAccessOwner;
authJWT.hasPermission = hasPermission;
authJWT.optional = optionalAuthJWT;

module.exports = authJWT;
