import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // Dev-only: the browser can't fetch svgl SVG files cross-origin (they send no
    // CORS headers). In the Tauri app the Rust `fetch_url` command handles this;
    // under `bun run dev` we proxy /svgl -> svgl.app so it is same-origin.
    proxy: {
      "/svgl": {
        target: "https://svgl.app",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/svgl/, ""),
      },
    },
  },
}));
