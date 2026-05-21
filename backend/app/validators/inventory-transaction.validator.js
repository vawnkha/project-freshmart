function hasInventoryItemId(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

module.exports = {
  hasInventoryItemId,
};
