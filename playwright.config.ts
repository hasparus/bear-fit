import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  outputDir: "./test/results",
  reporter: "html",
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
  },
});
