function sanitizeUser(user) {
  if (!user) return user;

  const {
    password,
    activation_token,
    activation_token_expires,
    resetToken,
    resetTokenExpiresAt,
    ...safeUser
  } = user;

  return safeUser;
}

function sanitizeUsers(users = []) {
  return users.map((user) => sanitizeUser(user));
}

function pickUserUpdate(payload = {}, options = {}) {
  const allowedFields = ["name", "email", "phone", "avatar_url", "address"];
  const update = {};

  for (const field of allowedFields) {
    if (payload[field] !== undefined) update[field] = payload[field];
  }

  if (options.allowAdminFields) {
    if (payload.status !== undefined) update.status = payload.status;
  }

  if (options.allowPassword && payload.password !== undefined) {
    update.password = payload.password;
  }

  return update;
}

module.exports = {
  sanitizeUser,
  sanitizeUsers,
  pickUserUpdate,
};
