function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateAddress(req) {
  return hasValue(req.body?.user_id) ? ok() : bad("user_id khong hop le");
}

function validateFindByUser(req) {
  return hasValue(req.query?.userId) ? ok() : bad("userId la bat buoc");
}

module.exports = {
  validateCreateAddress,
  validateFindByUser,
};
