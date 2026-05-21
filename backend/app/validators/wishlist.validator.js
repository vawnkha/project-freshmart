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
  return hasValue(req.body?.productId) ? ok() : bad("ProductId la bat buoc");
}

module.exports = {
  validateAddItem,
};
