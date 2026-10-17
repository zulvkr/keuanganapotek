import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_API_URL || "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/health": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/docs": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/openapi.json": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/llms.txt": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/llms-full.txt": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
