const { read, validateEnvironment } = require("./environment");
const MIN_JWT_SECRET_LENGTH = require("./environment").catalog.JWT_SECRET.minLength;

function getJwtConfig() {
  return {
    secret: read("JWT_SECRET"),
    algorithm: "HS256",
    expiresIn: read("JWT_EXPIRES_IN"),
    issuer: read("JWT_ISSUER"),
    audience: read("JWT_AUDIENCE"),
  };
}

function getOutboxEncryptionSecret() {
  return read("OUTBOX_ENCRYPTION_KEY");
}

function getAllowedOrigins() {
  if (read("NODE_ENV") === "production" && !process.env.CORS_ORIGINS) {
    throw new Error("CORS_ORIGINS is required in production");
  }
  return read("CORS_ORIGINS").split(",");
}

function buildCorsOptions() {
  const allowedOrigins = new Set(getAllowedOrigins());
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
  };
}

function validateRuntimeConfig() {
  validateEnvironment();
  require("./shrimp-diagnosis").diagnosisConfig();
  getJwtConfig();
  getOutboxEncryptionSecret();
  getAllowedOrigins();
}

module.exports = {
  MIN_JWT_SECRET_LENGTH,
  buildCorsOptions,
  getAllowedOrigins,
  getJwtConfig,
  getOutboxEncryptionSecret,
  validateRuntimeConfig,
};
