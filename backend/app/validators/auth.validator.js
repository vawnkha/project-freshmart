function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function missing(payload, fields) {
  return fields.filter((field) => !hasValue(payload[field]));
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateLogin(req) {
  return missing(req.body || {}, ["email", "password"]).length
    ? bad("Email va mat khau la bat buoc")
    : ok();
}

function validateChangePassword(req) {
  return missing(req.body || {}, ["oldPassword", "newPassword"]).length
    ? bad("Mat khau cu va mat khau moi la bat buoc")
    : ok();
}

function validateForgotPassword(req) {
  return missing(req.body || {}, ["email"]).length
    ? bad("Email khong duoc de trong")
    : ok();
}

function validateResetPassword(req) {
  return missing(req.body || {}, ["newPassword"]).length || !hasValue(req.params?.token)
    ? bad("Token va mat khau moi la bat buoc")
    : ok();
}

module.exports = {
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
};
