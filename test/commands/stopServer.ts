import type { BrowserCommand } from "vitest/node";

export const stopServer = ((_ctx, pid) => {
  process.kill(pid);
}) satisfies BrowserCommand<[number]>;
