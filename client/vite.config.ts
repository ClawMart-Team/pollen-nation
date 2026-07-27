import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // reachable from a phone on the LAN
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
