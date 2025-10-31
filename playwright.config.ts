import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  outputDir: "./test/results",
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 2 : 0,
  testDir: "./app",
  workers: process.env.CI ? 1 : undefined,

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          downloadsPath: "./test/downloads/chromium",
        },
      },
    },
  ],

  use: {
    baseURL: "http://127.0.0.1:1999",
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "on-first-retry",
  },

  webServer: {
    command: "pnpm dev --port 1999",
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 60000,
    url: "http://localhost:1999",
    env: {
      PUBLIC_KEY_B64: (() => {
        const pubkeyPath = path.join(
          process.cwd(),
          ".ssh",
          "test",
          "id_ed25519.pub",
        );
        try {
          return fs.readFileSync(pubkeyPath, "utf8").trim();
        } catch (error) {
          throw new Error(
            `Failed to read ${pubkeyPath}. Ensure it exists before running Playwright tests.`,
            { cause: error },
          );
        }
      })(),
    },
  },
});
