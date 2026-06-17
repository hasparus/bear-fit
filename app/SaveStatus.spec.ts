import { type Page } from "@playwright/test";

import { expect, test } from "../test";
import { createEvent as createEventBase } from "../test/utils/createEvent";

test.setTimeout(60_000);

const createEvent = (page: Page) =>
  createEventBase(page, { name: "sync status test" });

test("reflects online, offline, and reconnected sync state", async ({
  page,
}) => {
  await createEvent(page);

  const indicator = page.locator("[data-sync-status]");

  await expect(indicator).toHaveAttribute("data-sync-status", "saved");
  await expect(indicator).toContainText("saved");
  const savedColor = await indicator.evaluate(
    (el) => getComputedStyle(el).color,
  );

  await page.context().setOffline(true);
  await expect(indicator).toHaveAttribute("data-sync-status", "offline");
  await expect(indicator).toContainText("offline");

  const offlineColor = await indicator.evaluate(
    (el) => getComputedStyle(el).color,
  );
  expect(offlineColor).not.toBe(savedColor);

  await expect(
    page.getByText("will sync when you're back online"),
  ).toBeAttached();

  await page.context().setOffline(false);
  await expect(indicator).toHaveAttribute("data-sync-status", "saved", {
    timeout: 15_000,
  });
});

test("the indicator hides on the create screen (nothing to save yet)", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  await expect(page.locator("[data-sync-status]")).toHaveCount(0);
});

test("Cmd/Ctrl+S pops the auto-save toast above the status indicator", async ({
  page,
}) => {
  await createEvent(page);

  const toast = page.getByText("bear fit saves automatically");
  await expect(toast).toHaveAttribute("data-show", "false");

  await page.keyboard.press("ControlOrMeta+s");
  await expect(toast).toHaveAttribute("data-show", "true");

  await expect(page.locator("[data-sync-status]")).toContainText(
    "bear fit saves automatically",
  );

  await expect(toast).toHaveAttribute("data-show", "false", { timeout: 4000 });
});

test("hovering the status reveals the toast with no JS (CSS only)", async ({
  page,
}) => {
  await createEvent(page);

  const toast = page.getByText("bear fit saves automatically");
  await expect(toast).toHaveCSS("opacity", "0");

  await page.locator("[data-sync-status]").hover();
  await expect(toast).toHaveCSS("opacity", "1");
});

test('"/" stays typable in form fields (Quick Find suppression is field-aware)', async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const name = page.getByLabel("Name your event");
  await name.fill("");
  await name.pressSequentially("lunch w/ team");

  await expect(name).toHaveValue("lunch w/ team");
});
