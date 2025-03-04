import type { BrowserCommand } from "vitest/node";

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const VERBOSE = process.env.VERBOSE === "true";

export const startServer = (() => {
  const port = Math.floor(Math.random() * 10_000) + 3000;

  const spawned = spawn("pnpm", ["dev", "--port", `${port}`], {
    cwd: resolve(import.meta.dirname, "../.."),
  });
  const pid = spawned.pid!;

  spawned.stdout.on("data", (data) => {
    if (VERBOSE) {
      console.log(data.toString());
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

  return {
    // fetchJson(path: string) {
    //   return fetch(`http://localhost:${port}${path}`).then((res) => res.json());
    // },
    href: `http://localhost:${port}`,
    get pid() {
      return pid;
    },
    port,
  };
}) satisfies BrowserCommand<[]>;
