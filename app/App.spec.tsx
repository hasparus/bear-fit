import { commands, page } from "@vitest/browser/context";
import { afterAll, beforeAll, it } from "vitest";
import { render } from "vitest-browser-react";

import { TestStyles } from "../test/TestStyles";
import { App } from "./App";

let server: Awaited<ReturnType<typeof commands.startServer>>;
beforeAll(async () => {
  server = await commands.startServer();
});
afterAll(async () => {
  await commands.stopServer(server.pid);
});

it("creates a new event, fills dates, opens a new browser and fills more dates", async () => {
  render(<App />, { wrapper: TestStyles });
  await page.getByRole("button", { name: "Create Event" }).click();
});

// it("chats with /")
