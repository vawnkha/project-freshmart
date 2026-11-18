// Shared by Vite configuration and browser configuration.
export const DEFAULT_API_ORIGIN = "http://localhost:3000";
export const FRONTEND_PORT = 3001;

export function httpUrl(name, value, fallback = DEFAULT_API_ORIGIN) {
  if (value === undefined) return fallback;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    throw new Error(`Invalid environment variable: ${name}`);
  }
  return value;
}
