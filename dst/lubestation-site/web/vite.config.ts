import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiMock } from "./dev/apiMock.ts";

// Same policy as public/.htaccess, so CSP problems show up in `vite preview` before deploying.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

// The site is served from the domain root (lubestation.ir) with clean URLs.
export default defineConfig({
  base: "/",
  plugins: [react(), apiMock(fileURLToPath(new URL("./public/lubestation-data-template.xlsx", import.meta.url)))],
  preview: {
    headers: { "Content-Security-Policy": CSP },
  },
  build: {
    // three.js alone is ~520 kB minified; it is isolated in its own lazily-loaded chunk.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
        },
      },
    },
  },
});
