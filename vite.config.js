import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/", // <-- Ensure this is explicitly set to a forward slash
  server: {
    historyApiFallback: true, // <-- Forces Vite local fallback
  },
});
