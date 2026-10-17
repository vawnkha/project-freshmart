const jwt = require("jsonwebtoken");
const { getJwtConfig } = require("../config/security");

function signAccessToken(payload) {
  const config = getJwtConfig();
  return jwt.sign(payload, config.secret, {
    algorithm: config.algorithm,
    expiresIn: config.expiresIn,
    issuer: config.issuer,
    audience: config.audience,
  });
}

function verifyAccessToken(token) {
  const config = getJwtConfig();
  return jwt.verify(token, config.secret, {
    algorithms: [config.algorithm],
    issuer: config.issuer,
    audience: config.audience,
  });
}

module.exports = { signAccessToken, verifyAccessToken };
