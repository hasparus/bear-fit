import { defineConfig, devices } from "@playwright/test";

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
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: {
          downloadsPath: "./test/downloads/firefox",
          firefoxUserPrefs: {
            "dom.events.asyncClipboard.clipboardItem": true,
            "dom.events.asyncClipboard.readText": true,
            "dom.events.testing.asyncClipboard": true,
          },
        },
      },
    },
  ],

  use: {
    baseURL: "http://127.0.0.1:1999",
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
