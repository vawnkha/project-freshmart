function validateStatus(status) {
  return ["available", "expired", "locked", "sold_out"].includes(status)
    ? null
    : "Trang thai lo hang khong hop le";
}

module.exports = {
  validateStatus,
};
