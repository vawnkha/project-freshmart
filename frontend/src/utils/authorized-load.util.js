import { hasAnyPermission } from "./permission.util.js";

export function loadWhenAllowed(authState, permissions, loader) {
  return hasAnyPermission(authState, permissions) ? loader() : Promise.resolve([]);
}
