const { z } = require("zod");
const { emailSchema, nonEmptyString, optionalString } = require("./common.validator");
const nameSchema = nonEmptyString.pipe(z.string().max(120));

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
    name: nameSchema,
    email: emailSchema,
    password: z.string().min(8).max(128),
    phone: optionalString.refine((value) => !value || value.length <= 30),
    address: optionalString.refine((value) => !value || value.length <= 500),
  }),
  updateUserSchema: z
    .object({
      name: nameSchema.optional(),
      email: emailSchema.optional(),
      phone: optionalString.refine((value) => !value || value.length <= 30),
      address: optionalString.refine((value) => !value || value.length <= 500),
      status: z.enum(["pending", "active", "blocked"]).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Data to update can not be empty",
    }),
  validateCreateUser,
  validateUpdateUser,
};
