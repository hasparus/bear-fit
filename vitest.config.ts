import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { readDownloadedJsonExport } from "./test/commands/readDownloadedJsonExport";
import { startServer } from "./test/commands/startServer";
import { stopServer } from "./test/commands/stopServer";

const headless = process.env.HEADED !== "true";

export default defineConfig({
  plugins: [react(), tailwind()],
  test: {
    browser: {
      provider: "playwright",
      enabled: true,
      headless,
      // https://vitest.dev/guide/browser/playwright
      commands: {
        readDownloadedJsonExport,
        startServer,
        stopServer,
      },

      instances: [
        {
          browser: "chromium",
          testTimeout: 60_000,
          context: {
            permissions: ["clipboard-read", "clipboard-write"],
            
          },
          launch: {
            downloadsPath: "./test/downloads",
          },
        },
      ],
    },
  },
});

declare module "@vitest/browser/context" {
  interface BrowserCommands {
    readDownloadedJsonExport: Command<typeof readDownloadedJsonExport>;
    startServer: Command<typeof startServer>;
    stopServer: Command<typeof stopServer>;
  }
}

type Command<T> = T extends (first: never, ...args: infer U) => infer R
  ? (...args: U) => Promise<R>
  : never;
