function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateProduct(req) {
  const body = req.body || {};
  if (!hasValue(body.name)) return bad("name la bat buoc");
  if (!hasValue(body.category_id) && !hasValue(body.inventoryItemId)) {
    return bad("category_id la bat buoc");
  }
  return ok();
}

function validateUpdateProduct(req) {
  return Object.keys(req.body || {}).length
    ? ok()
    : bad("Du lieu de cap nhat khong duoc de trong");
}

function validateProductCreateData(body = {}) {
  if (!hasValue(body.name)) return "name la bat buoc";
  if (!hasValue(body.category_id) && !hasValue(body.inventoryItemId)) {
    return "category_id la bat buoc";
  }
  return null;
}

function validateProductUpdateData(body = {}) {
  return Object.keys(body || {}).length
    ? null
    : "Du lieu de cap nhat khong duoc de trong";
}

function validateCreateFromInventory(body = {}) {
  if (body.sellingPrice !== undefined && Number(body.sellingPrice) < 0) {
    return "sellingPrice khong hop le";
  }
  if (body.price !== undefined && Number(body.price) < 0) {
    return "price khong hop le";
  }
  return null;
}

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductCreateData,
  validateProductUpdateData,
  validateCreateFromInventory,
};
