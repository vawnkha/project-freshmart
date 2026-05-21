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
  validateCreateNotification,
  validateBulkDelete,
};
