const { z } = require("zod");
const { emailSchema, nonEmptyString } = require("./common.validator");
const passwordSchema = z.string().min(8).max(128);
const credentialSchema = z.string().min(1, "Truong nay la bat buoc");

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
  loginBodySchema: z.object({
    email: emailSchema,
    password: credentialSchema,
  }),
  changePasswordBodySchema: z.object({
    oldPassword: credentialSchema,
    newPassword: passwordSchema,
  }),
  forgotPasswordBodySchema: z.object({ email: emailSchema }),
  resetPasswordBodySchema: z.object({ newPassword: passwordSchema }),
  resetPasswordParamsSchema: z.object({
    userId: z.string().regex(/^[a-f\d]{24}$/i, "userId khong hop le"),
    token: z.string().regex(/^[a-f\d]{64}$/i, "token khong hop le"),
  }),
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
};
