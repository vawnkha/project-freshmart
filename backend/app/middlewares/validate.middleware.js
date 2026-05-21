const ApiError = require("../api-error");

function validate(validator) {
  return (req, res, next) => {
    try {
      const result = validator(req);
      if (!result || result.valid !== false) return next();

      return next(
        new ApiError(result.statusCode || 400, result.message || "Du lieu khong hop le"),
      );
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = validate;
