import { fileURLToPath, URL } from "node:url";

import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";

import { httpUrl, FRONTEND_PORT } from "./config/environment.mjs";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_"), ...process.env };
  const target = httpUrl("VITE_API_PROXY_TARGET", env.VITE_API_PROXY_TARGET);
  httpUrl("VITE_API_URL", env.VITE_API_URL);
  return {
    // Keep the running web app separate from middleware/SSR test optimizers.
    cacheDir: "node_modules/.vite-dev",
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: FRONTEND_PORT,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
        "/uploads": {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
