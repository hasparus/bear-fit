import { test as base } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import v8toIstanbul from "v8-to-istanbul";

interface CoverageFixtures {
  autoTestFixture: void;
}

export const test = base.extend<CoverageFixtures>({
  autoTestFixture: [
    async ({ page }, use) => {
      // Start coverage before the test
      await page.coverage.startJSCoverage();

      await use();

      // Stop coverage and save after the test
      const coverage = await page.coverage.stopJSCoverage();

      const coverageDir = path.join(process.cwd(), "test/coverage");
      await fs.mkdir(coverageDir, { recursive: true });

      await Promise.all(
        coverage.map(async (entry) => {
          // Extract the filename from the URL (e.g., "client.js" from "http://127.0.0.1:1999/dist/client.js")
          const filename = path.basename(entry.url);
          // Map to the actual file location in public/dist/
          const filepath = path.join(process.cwd(), "public", "dist", filename);

          const isExternalScript = await fs
            .access(filepath)
            .then(() => false)
            .catch(() => true);

          if (isExternalScript) {
            return; // skip coverage for third-party scripts that are not bundled locally
          }

          const converter = v8toIstanbul(filepath, 0, {
            source: entry.source!,
          });
          await converter.load();
          converter.applyCoverage(entry.functions);
          await fs.writeFile(
            path.join(coverageDir, filename + ".json"),
            JSON.stringify(converter.toIstanbul()),
            "utf-8",
          );
        }),
      );
    },
    { auto: true },
  ],
});

export const expect = test.expect;
