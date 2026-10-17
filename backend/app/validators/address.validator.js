const { z } = require("zod");
const { idParamSchema, nonEmptyString, objectIdSchema } = require("./common.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateAddress(req) {
  return hasValue(req.body?.user_id) ? ok() : bad("user_id khong hop le");
}

function validateFindByUser(req) {
  return hasValue(req.query?.userId) ? ok() : bad("userId la bat buoc");
}

module.exports = {
  addressIdParamSchema: idParamSchema,
  addressByUserQuerySchema: z.object({ userId: objectIdSchema }),
  createAddressSchema: z.object({
    user_id: objectIdSchema,
    full_name: nonEmptyString,
    phone: nonEmptyString,
    address_line: nonEmptyString,
    city: nonEmptyString,
    is_default: z.boolean().optional(),
  }),
  updateAddressSchema: z.object({
    full_name: nonEmptyString.optional(),
    phone: nonEmptyString.optional(),
    address_line: nonEmptyString.optional(),
    city: nonEmptyString.optional(),
    is_default: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Du lieu cap nhat khong duoc de trong",
  }),
  validateCreateAddress,
  validateFindByUser,
};
