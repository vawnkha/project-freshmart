const MIN_JWT_SECRET_LENGTH = 32;

function getRequiredSecret(name, minLength = 1) {
  const value = String(process.env[name] || "").trim();
  if (value.length < minLength) {
    throw new Error(
      `${name} is required and must contain at least ${minLength} characters`,
    );
  }
  return value;
}

function getJwtConfig() {
  return {
    secret: getRequiredSecret("JWT_SECRET", MIN_JWT_SECRET_LENGTH),
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    issuer: process.env.JWT_ISSUER || "lv-ecommerce-api",
    audience: process.env.JWT_AUDIENCE || "lv-ecommerce-web",
  };
}

function getOutboxEncryptionSecret() {
  return getRequiredSecret("OUTBOX_ENCRYPTION_KEY", 32);
}

function getAllowedOrigins() {
  const configured = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CORS_ORIGINS is required in production");
  }

  return ["http://localhost:3001", "http://127.0.0.1:3001"];
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
