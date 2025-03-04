import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { startServer } from "./test/commands/startServer";
import { stopServer } from "./test/commands/stopServer";

export default defineConfig({
  plugins: [react(), tailwind()],
  test: {
    browser: {
      enabled: true,
      headless: process.env.CI === "true",
      provider: "playwright",
      // https://vitest.dev/guide/browser/playwright
      commands: {
        startServer,
        stopServer,
      },

      instances: [{ browser: "webkit", testTimeout: 60_000 }],
    },
  },
});

declare module "@vitest/browser/context" {
  interface BrowserCommands {
    startServer: Command<typeof startServer>;
    stopServer: Command<typeof stopServer>;
  }
}

type Command<T> = T extends (first: never, ...args: infer U) => infer R
  ? (...args: U) => Promise<R>
  : never;
