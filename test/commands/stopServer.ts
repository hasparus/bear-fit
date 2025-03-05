import type { BrowserCommand } from "vitest/node";

export const stopServer = ((_ctx, pid) => {
  console.log("stopping server with pid", pid);
  process.kill(pid);
}) satisfies BrowserCommand<[number]>;
