import type { BrowserCommand } from "vitest/node";

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const VERBOSE = process.env.VERBOSE === "true";

export const startServer = (async () => {
  const port = Math.floor(Math.random() * 10_000) + 3000;

  const spawned = spawn("pnpm", ["dev", "--port", `${port}`], {
    cwd: resolve(import.meta.dirname, "../.."),
  });

  const pid = spawned.pid!;

  const serverStarted = Promise.withResolvers<void>();

  spawned.stdout.on("data", (data) => {
    if (VERBOSE) {
      console.log(data.toString());
    }

    if (data.toString().includes("Ready on")) {
      serverStarted.resolve();
    }
  });

  spawned.stderr.on("data", (data) => {
    console.error(data.toString());
  });

  if (!pid) {
    throw new Error("Failed to start vite dev server");
  } else if (VERBOSE) {
    console.log(`Vite dev server started on port ${port}`);
  }

  await serverStarted.promise;

  return {
    href: `http://localhost:${port}`,
    pid,
    port,
  };
}) satisfies BrowserCommand<[]>;
