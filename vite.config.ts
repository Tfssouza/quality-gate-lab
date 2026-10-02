import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/web",
  server: {
    port: Number(process.env.WEB_PORT || 3000),
    strictPort: true,
    proxy: { "/api": process.env.VITE_API_TARGET || "http://127.0.0.1:3001" },
  },
  build: { outDir: "../../dist/web", emptyOutDir: true },
});
