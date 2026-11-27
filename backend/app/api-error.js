class ApiError extends Error {
  constructor(statusCode, message, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    if (code) this.code = code;
    if (details !== undefined) this.details = details;
  }
}

module.exports = ApiError;
