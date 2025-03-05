import type { BrowserCommand } from "vitest/node";

import { readdir, readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

export const readDownloadedJsonExport = (async (_ctx) => {
  try {
    const downloadsPath = resolve(import.meta.dirname, "../downloads");

    let file = "";

    while (!file) {
      const files = (await readdir(downloadsPath)).filter(
        (file) => file !== ".gitignore",
      );

      // we assume there's just one file here
      // ideally, we'd get a name of the download from playwright, but we don't
      file = files.at(-1) ?? "";

      if (!file) {
        // if we don't have at least one file, we wait and try to read again
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const content = await readFile(resolve(downloadsPath, file), "utf-8");

    await unlink(resolve(downloadsPath, file));

    return content;
  } catch (error) {
    console.error("Failed to read downloaded JSON export");
    console.error(error);
    throw error;
  }
}) satisfies BrowserCommand<[]>;
