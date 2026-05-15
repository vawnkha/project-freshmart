export function decodeJwtPayload(token) {
  const payload = token?.split(".")?.[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isJwtExpired(payload) {
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now();
}

export function hasJwtPermission(payload, permission) {
  const permissions = Array.isArray(payload?.permissions)
    ? payload.permissions
    : [];

  return (
    payload?.role === "admin" ||
    permissions.includes("*") ||
    permissions.includes(permission)
  );
}

export function hasAllJwtPermissions(payload, permissions = []) {
  return permissions.every((permission) =>
    hasJwtPermission(payload, permission),
  );
}
