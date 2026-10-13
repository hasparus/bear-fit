import type { Page, WebSocket } from "@playwright/test";

import { expect, test } from "../test";
import { createCalendar, fillCreateForm } from "../test/utils/createCalendar";

test.setTimeout(60_000);

/** Counts the page's open sync WebSockets per calendar. */
function trackSyncSockets(page: Page) {
  const open = new Set<WebSocket>();
  page.on("websocket", (ws) => {
    open.add(ws);
    ws.on("close", () => open.delete(ws));
  });
  return (id: string) =>
    [...open].filter(
      (ws) => new URL(ws.url()).pathname === `/parties/main/${id}`,
    ).length;
}

/**
 * Each y-partyserver provider registers a window `unload` listener until it's
 * destroyed, so the live ones are a proxy for providers that still exist.
 * Assumes nothing else on the page listens for `unload`.
 */
async function trackUnloadListeners(page: Page) {
  await page.addInitScript(() => {
    const listeners = new Set<unknown>();
    const { addEventListener, removeEventListener } = window;
    window.addEventListener = function (
      this: Window,
      ...args: Parameters<Window["addEventListener"]>
    ) {
      if (args[0] === "unload") listeners.add(args[1]);
      return addEventListener.apply(this, args);
    } as Window["addEventListener"];
    window.removeEventListener = function (
      this: Window,
      ...args: Parameters<Window["removeEventListener"]>
    ) {
      if (args[0] === "unload") listeners.delete(args[1]);
      return removeEventListener.apply(this, args);
    } as Window["removeEventListener"];
    Object.assign(window, { unloadListeners: () => listeners.size });
  });
  return () =>
    page.evaluate(() =>
      (
        window as unknown as { unloadListeners: () => number }
      ).unloadListeners(),
    );
}

async function waitForSaved(page: Page) {
  await expect(page.locator("[data-sync-status]")).toHaveAttribute(
    "data-sync-status",
    "saved",
  );
}

test("a direct visit opens one sync socket", async ({ browser, page }) => {
  const { id } = await createCalendar(page);

  await using context = await browser.newContext();
  const visitor = await context.newPage();
  const openSockets = trackSyncSockets(visitor);
  const liveProviders = await trackUnloadListeners(visitor);
  await visitor.goto(`/?id=${id}`);
  await waitForSaved(visitor);

  expect(openSockets(id)).toBe(1);
  expect(await liveProviders()).toBe(1);
});

test("switching calendars closes the old socket and provider", async ({
  page,
}) => {
  const openSockets = trackSyncSockets(page);
  const liveProviders = await trackUnloadListeners(page);

  const { id: first } = await createCalendar(page, { name: "first" });
  await waitForSaved(page);
  expect(openSockets(first)).toBe(1);
  expect(await liveProviders()).toBe(1);

  await page.goBack();
  await fillCreateForm(page, { name: "second" });
  await page.getByText("Create Calendar").click();
  await expect(page).toHaveURL(/\?id=/);
  const second = new URL(page.url()).searchParams.get("id")!;
  await waitForSaved(page);
  expect(openSockets(second)).toBe(1);
  await expect.poll(() => openSockets(first)).toBe(0);
  expect(await liveProviders()).toBe(1);

  await page.goBack();
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });
  await page.goForward();
  await waitForSaved(page);
  expect(openSockets(second)).toBe(1);
  expect(await liveProviders()).toBe(1);
});
