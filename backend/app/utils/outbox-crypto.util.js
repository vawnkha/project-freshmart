const crypto = require("crypto");
const { getOutboxEncryptionSecret } = require("../config/security");

function getKey() {
  return crypto
    .createHmac("sha256", getOutboxEncryptionSecret())
    .update("outbox-events-v1")
    .digest();
}

function encryptOutboxPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptOutboxPayload(payload) {
  if (!payload || payload.version !== 1) return payload;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

module.exports = { decryptOutboxPayload, encryptOutboxPayload };
