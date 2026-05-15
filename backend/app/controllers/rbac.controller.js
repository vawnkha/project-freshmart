const ApiError = require("../api-error");
const MongoDB = require("../utils/mongodb.util");
const RbacService = require("../services/rbac.service");
const { sanitizeUser } = require("../utils/user.util");

function getService() {
  return new RbacService(MongoDB.client);
}

exports.listPermissions = async (req, res, next) => {
  try {
    const permissions = await getService().listPermissions();
    return res.send({ data: permissions });
  } catch (error) {
    return next(error);
  }
};

exports.listRoles = async (req, res, next) => {
  try {
    const roles = await getService().listRoles();
    return res.send({ data: roles });
  } catch (error) {
    return next(error);
  }
};

exports.findRole = async (req, res, next) => {
  try {
    const role = await getService().getRoleWithPermissions(req.params.id);

    if (!role) {
      return next(new ApiError(404, "Role khong ton tai"));
    }

    return res.send({ data: role });
  } catch (error) {
    return next(error);
  }
};

exports.createRole = async (req, res, next) => {
  try {
    const role = await getService().createRole(req.body, req.user);
    return res.status(201).send({
      message: "Tao role thanh cong",
      data: role,
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const role = await getService().updateRole(
      req.params.id,
      req.body,
      req.user,
    );

    return res.send({
      message: "Cap nhat role thanh cong",
      data: role,
    });
  } catch (error) {
    return next(error);
  }
};

exports.deleteRole = async (req, res, next) => {
  try {
    await getService().deleteRole(req.params.id);
    return res.send({ message: "Xoa role thanh cong" });
  } catch (error) {
    return next(error);
  }
};

exports.assignRoleToUser = async (req, res, next) => {
  try {
    const roleIdOrCode = req.body.role_id || req.body.roleId || req.body.code;

    if (!roleIdOrCode) {
      return next(new ApiError(400, "Role la bat buoc"));
    }

    const user = await getService().assignRoleToUser(
      req.params.id,
      roleIdOrCode,
      req.user,
    );

    return res.send({
      message: "Gan role cho nguoi dung thanh cong",
      data: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};
