const { z } = require("zod");
const { emailSchema, nonEmptyString } = require("./common.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateContact(req) {
  const body = req.body || {};
  if (
    !hasValue(body.name) ||
    !hasValue(body.email) ||
    !hasValue(body.subject) ||
    !hasValue(body.content)
  ) {
    return bad("Vui long nhap day du thong tin lien he");
  }
  return ok();
}

function validateReply(req) {
  return hasValue(req.body?.admin_reply)
    ? ok()
    : bad("Noi dung phan hoi khong duoc de trong");
}

module.exports = {
  createContactSchema: z.object({
    name: nonEmptyString,
    email: emailSchema,
    subject: nonEmptyString,
    content: nonEmptyString,
  }),
  replyContactSchema: z.object({ admin_reply: nonEmptyString }),
  validateCreateContact,
  validateReply,
};
