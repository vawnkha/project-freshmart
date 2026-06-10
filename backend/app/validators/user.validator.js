const { z } = require("zod");
const { emailSchema, nonEmptyString, optionalString } = require("./common.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateUser(req) {
  const body = req.body || {};
  if (!hasValue(body.name)) return bad("name la bat buoc");
  if (!hasValue(body.email)) return bad("Email la bat buoc");
  if (!hasValue(body.password)) return bad("Mat khau la bat buoc");
  return ok();
}

function validateUpdateUser(req) {
  return Object.keys(req.body || {}).length
    ? ok()
    : bad("Data to update can not be empty");
}

module.exports = {
  createUserSchema: z.object({
    name: nonEmptyString,
    email: emailSchema,
    password: nonEmptyString,
    phone: optionalString,
    address: optionalString,
  }),
  validateCreateUser,
  validateUpdateUser,
};
