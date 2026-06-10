const ApiError = require("../api-error");

function getIssues(error) {
  return Array.isArray(error?.issues) ? error.issues : [];
}

function formatPath(scope, path = []) {
  const value = path.join(".");
  return value || scope;
}

function flattenErrors(scope, error) {
  return getIssues(error).map((issue) => ({
    field: formatPath(scope, issue.path),
    message: issue.message,
  }));
}

function isZodSchema(schema) {
  return schema && typeof schema.safeParse === "function";
}

function assignRequestPart(req, part, value) {
  if (part === "query") {
    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
    return;
  }

  req[part] = value;
}

function validate(validator) {
  return (req, res, next) => {
    try {
      if (validator && typeof validator === "object" && !Array.isArray(validator)) {
        const errors = [];

        if (isZodSchema(validator.body)) {
          const parsed = validator.body.safeParse(req.body || {});
          if (!parsed.success) {
            errors.push(...flattenErrors("body", parsed.error));
          } else {
            assignRequestPart(req, "body", parsed.data);
          }
        }

        if (isZodSchema(validator.params)) {
          const parsed = validator.params.safeParse(req.params || {});
          if (!parsed.success) {
            errors.push(...flattenErrors("params", parsed.error));
          } else {
            assignRequestPart(req, "params", parsed.data);
          }
        }

        if (isZodSchema(validator.query)) {
          const parsed = validator.query.safeParse(req.query || {});
          if (!parsed.success) {
            errors.push(...flattenErrors("query", parsed.error));
          } else {
            assignRequestPart(req, "query", parsed.data);
          }
        }

        if (errors.length) {
          return res.status(400).json({
            success: false,
            message: "Du lieu khong hop le",
            errors,
          });
        }

        return next();
      }

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
