import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/ - the deploy workflow sets
  // VITE_BASE_PATH before building; local dev/builds fall back to root.
  base: process.env.VITE_BASE_PATH || "/",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target:
          process.env.VITE_BACKEND_TARGET ||
          "https://forte-innovations-llc-composed-digitalized-framework-ap25ce94a1.cfapps.us10-001.hana.ondemand.com",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        // Skip eval warnings from react-jvectormap
        if (
          warning.code === "EVAL" &&
          warning.id?.includes("@react-jvectormap")
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
