import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare(), react(), tailwind()],
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.APP_VERSION ?? "localhost"),
    "import.meta.env.ALWAYS_PROD": process.env.ALWAYS_PROD ? "1" : "0",
    __PROD_SERVER_URL__: JSON.stringify(process.env.PROD_SERVER_URL ?? ""),
  },
  environments: {
    client: {
      build: {
        sourcemap: true,
        rollupOptions: {
          input: {
            main: "index.html",
            dashboard: "dashboard.html",
          },
        },
      },
    },
  },
});
