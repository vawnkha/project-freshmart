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

function validateCaptureOrder(req) {
  const body = req.body || {};
  if (
    !hasValue(body.paypalOrderId) ||
    !hasValue(body.user_id) ||
    !hasValue(body.address_id)
  ) {
    return bad("paypalOrderId, user_id, address_id la bat buoc");
  }
  return ok();
}

module.exports = {
  validateCreateOrder,
  validateCaptureOrder,
};
