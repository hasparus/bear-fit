import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const TEST_PUBLIC_KEY_B64 = (() => {
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
})();

// @cloudflare/vite-plugin sources Worker vars from `.dev.vars`/`.env`. Dev
const devVars = `PUBLIC_KEY_B64="${TEST_PUBLIC_KEY_B64}"\n`;
for (const dir of [process.cwd(), path.join(process.cwd(), "dist", "bear_fit")]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, ".dev.vars"), devVars);
  } catch (error) {
    console.warn(`Could not write .dev.vars to ${dir}`, error);
  }
}

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
    command: "pnpm exec vite preview --port 1999",
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 60000,
    url: "http://127.0.0.1:1999",
    env: {
      PUBLIC_KEY_B64: TEST_PUBLIC_KEY_B64,
    },
  },
});
