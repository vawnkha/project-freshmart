function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateOrder(req) {
  const body = req.body || {};
  if (!hasValue(body.user_id) || !hasValue(body.address_id)) {
    return bad("user_id va address_id la bat buoc");
  }
  return ok();
}

function validateUpdateStatus(req) {
  return hasValue(req.body?.status) ? ok() : bad("status la bat buoc");
}

module.exports = {
  validateCreateOrder,
  validateUpdateStatus,
};
