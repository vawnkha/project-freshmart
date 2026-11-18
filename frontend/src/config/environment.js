import { httpUrl } from "../../config/environment.mjs";

// VITE_* values are public and are baked into the browser bundle at build time.
export const socketOrigin = httpUrl("VITE_API_URL", import.meta.env.VITE_API_URL);
