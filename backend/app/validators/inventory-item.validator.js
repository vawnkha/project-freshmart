function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateCreate(payload = {}) {
  if (!hasValue(payload.itemCode)) return "itemCode la bat buoc";
  if (!hasValue(payload.itemName)) return "itemName la bat buoc";
  if (!hasValue(payload.unit)) return "unit la bat buoc";
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
