function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Danh sach hang nhap khong duoc de trong";
  }

  for (const item of items) {
    if (!hasValue(item.inventoryItemId)) return "inventoryItemId la bat buoc";
    if (Number(item.quantity || 0) <= 0) return "quantity phai lon hon 0";
    if (Number(item.importPrice || 0) < 0) return "importPrice khong hop le";
    if (!hasValue(item.batchNumber)) return "batchNumber la bat buoc";
    if (!hasValue(item.expiryDate)) return "expiryDate la bat buoc";
  }

  return null;
}

function validateCreate(payload = {}) {
  return validateItems(payload.items);
}

function validateUpdate(payload = {}) {
  if (!Object.keys(payload || {}).length) {
    return "Du lieu cap nhat khong duoc de trong";
  }

  if (payload.items !== undefined) return validateItems(payload.items);
  return null;
}

module.exports = {
  validateCreate,
  validateUpdate,
};
