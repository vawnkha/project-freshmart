function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateCreate(payload = {}, options = {}) {
  if (!hasValue(payload.name)) return "name la bat buoc";
  if (options.requireCode && !hasValue(payload.code)) return "code la bat buoc";
  return null;
}

function validateUpdate(payload = {}) {
  return Object.keys(payload || {}).length
    ? null
    : "Du lieu cap nhat khong duoc de trong";
}

module.exports = {
  validateCreate,
  validateUpdate,
};
