import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const TEST_PUBLIC_KEY_B64 = (() => {
  const pubkeyPath = path.join(process.cwd(), ".ssh", "test", "id_ed25519.pub");
  try {
    return fs.readFileSync(pubkeyPath, "utf8").trim();
  } catch (error) {
    throw new Error(
      `Failed to read ${pubkeyPath}. Ensure it exists before running Playwright tests.`,
      { cause: error },
    );
  }
})();

const PORT = Number(process.env.TEST_PORT ?? 1999);
const LEGACY_PORT = PORT + 1;

// @cloudflare/vite-plugin sources Worker vars from `.dev.vars`/`.env`. Dev
const devVars = [
  `PUBLIC_KEY_B64="${TEST_PUBLIC_KEY_B64}"`,
  `LEGACY_PARTYKIT_ORIGIN="http://127.0.0.1:${LEGACY_PORT}"`,
  "",
].join("\n");
for (const dir of [
  process.cwd(),
  path.join(process.cwd(), "dist", "bear_fit"),
]) {
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
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },

  webServer: [
    {
      command: `bun test/legacyPartykitServer.ts ${LEGACY_PORT}`,
      reuseExistingServer: !process.env.CI,
      url: `http://127.0.0.1:${LEGACY_PORT}/status`,
    },
    {
      command: `pnpm exec vite preview --port ${PORT} --strictPort`,
      reuseExistingServer: !process.env.CI,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 60000,
      url: `http://127.0.0.1:${PORT}`,
      env: {
        PUBLIC_KEY_B64: TEST_PUBLIC_KEY_B64,
      },
    },
  ],
});
