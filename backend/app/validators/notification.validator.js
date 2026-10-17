const { z } = require("zod");
const { idParamSchema, nonEmptyString, objectIdSchema, optionalString } = require("./common.validator");

const dataSchema = z.record(z.string(), z.unknown());
const notificationFields = {
  type: nonEmptyString,
  title: nonEmptyString,
  content: nonEmptyString,
  data: dataSchema.optional(),
  is_read: z.boolean().optional(),
};

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateNotification(req) {
  const body = req.body || {};
  if (!hasValue(body.type) || !hasValue(body.title) || !hasValue(body.content)) {
    return bad("Thieu thong tin tao thong bao");
  }
  return ok();
}

function validateBulkDelete(req) {
  return Array.isArray(req.body?.ids) && req.body.ids.length
    ? ok()
    : bad("Danh sach ids khong hop le");
}

module.exports = {
  notificationIdParamSchema: idParamSchema,
  notificationQuerySchema: z.object({
    type: optionalString,
    keyword: optionalString,
    is_read: z.preprocess(
      (value) => value === "" ? undefined : value,
      z.enum(["true", "false"]).optional(),
    ),
  }),
  createNotificationSchema: z.object(notificationFields),
  updateNotificationSchema: z.object({
    type: nonEmptyString.optional(),
    title: nonEmptyString.optional(),
    content: nonEmptyString.optional(),
    data: dataSchema.optional(),
    is_read: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Du lieu cap nhat khong duoc de trong",
  }),
  bulkDeleteNotificationsSchema: z.object({
    ids: z.array(objectIdSchema).min(1),
  }),
  validateCreateNotification,
  validateBulkDelete,
};
