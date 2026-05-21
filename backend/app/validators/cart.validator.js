function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateAddItem(req) {
  return hasValue(req.body?.product_id) || hasValue(req.body?.productId)
    ? ok()
    : bad("product_id la bat buoc");
}

function validateUpdateItem(req) {
  return hasValue(req.body?.quantity) ? ok() : bad("quantity la bat buoc");
}

module.exports = {
  validateAddItem,
  validateUpdateItem,
};
