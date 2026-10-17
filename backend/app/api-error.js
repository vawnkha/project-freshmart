class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    if (code) this.code = code;
  }
}

module.exports = ApiError;
