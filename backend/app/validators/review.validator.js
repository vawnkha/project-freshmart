function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function ok() {
  return { valid: true };
}

function bad(message) {
  return { valid: false, statusCode: 400, message };
}

function validateCreateReview(req) {
  const body = req.body || {};
  if (!hasValue(body.user_id)) return bad("user la bat buoc");
  if (!hasValue(body.product_id)) return bad("product la bat buoc");
  if (!hasValue(body.rating)) return bad("rating la bat buoc");

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return bad("rating phai la so nguyen tu 1 den 5");
  }

  return ok();
}

module.exports = {
  validateCreateReview,
};
