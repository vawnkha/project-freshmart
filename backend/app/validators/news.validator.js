function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validatePayload(payload = {}, options = {}) {
  if (options.requireRequiredFields) {
    if (!hasValue(payload.categoryId)) return "categoryId la bat buoc";
    if (!hasValue(payload.title)) return "title la bat buoc";
    if (!hasValue(payload.slug)) return "slug la bat buoc";
  }

  if (payload.status && !["draft", "published", "archived"].includes(String(payload.status))) {
    return "status khong hop le";
  }

  if (payload.images !== undefined && !Array.isArray(payload.images)) {
    return "images phai la mang";
  }

  if (payload.tags !== undefined && !Array.isArray(payload.tags)) {
    return "tags phai la mang";
  }

  return null;
}

function validateCreate(payload = {}) {
  return validatePayload(payload, { requireRequiredFields: true });
}

function validateUpdate(payload = {}) {
  if (!Object.keys(payload || {}).length) {
    return "Du lieu cap nhat khong duoc de trong";
  }

  return validatePayload(payload);
}

module.exports = {
  validateCreate,
  validateUpdate,
};
