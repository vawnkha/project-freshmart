export function normalizePermissions(permissions = []) {
  if (!Array.isArray(permissions)) return [];

  return [
    ...new Set(
      permissions
        .filter(Boolean)
        .map((permission) => String(permission).trim())
        .filter(Boolean),
    ),
  ];
}

export function hasPermission(authState = {}, permission) {
  if (!permission) return true;

  const permissions = normalizePermissions(authState.permissions);

  return (
    permissions.includes("*") ||
    permissions.includes(permission)
  );
}

export function hasAnyPermission(authState = {}, permissions = []) {
  const required = Array.isArray(permissions) ? permissions : [permissions];
  if (!required.length) return true;

  return required.some((permission) => hasPermission(authState, permission));
}

export function hasAllPermissions(authState = {}, permissions = []) {
  const required = Array.isArray(permissions) ? permissions : [permissions];
  if (!required.length) return true;

  return required.every((permission) => hasPermission(authState, permission));
}
