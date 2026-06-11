import { type Page } from "@playwright/test";

import { expect, test } from "../test";

test.setTimeout(60_000);

/** Creates an event and lands on its page. Returns nothing — the page is there. */
async function createEvent(page: Page) {
  await page.goto("/");
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `sync status ${Math.random().toString(36).slice(2)}`;
  await page.getByLabel("Name your event").fill(eventName);
  await page.getByRole("button", { name: "next month" }).click();

  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", { month: "long" });
  await expect(page.getByText(nextMonthName)).toBeVisible();

  await page.getByRole("button", { name: `${nextMonthName} 6th` }).click();
  await page.getByRole("button", { name: `${nextMonthName} 12th` }).click();
  await page.getByText("Create Event").click();

  await expect(page).toHaveURL(/\?id=/);
  await page.getByText("Event dates").waitFor({ state: "visible" });
}

test("reflects online, offline, and reconnected sync state", async ({ page }) => {
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

/**
 * The on-screen color of the offline status, accounting for the global
 * dark-mode `filter: invert(...)` on <body>. We read the actual filter rather
 * than hardcoding its amount, so the test stays honest if it changes.
 */
async function offlineStatusScreenColor(page: Page) {
  await page.context().setOffline(true);
  const indicator = page.locator("[data-sync-status]");
  await expect(indicator).toContainText("offline");

  const { filter, rgb } = await indicator.evaluate((el) => ({
    filter: getComputedStyle(document.body).filter,
    rgb: getComputedStyle(el)
      .color.match(/\d+/g)!
      .slice(0, 3)
      .map(Number),
  }));
  await page.context().setOffline(false);

  const inverted = filter.match(/invert\(([\d.]+)\)/);
  if (!inverted) return rgb;
  const amount = Number(inverted[1]);
  return rgb.map((c) => Math.round(c * (1 - amount) + (255 - c) * amount));
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`offline status reads orange in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await createEvent(page);

    const [r, g, b] = await offlineStatusScreenColor(page);
    expect(r).toBeGreaterThan(b + 60);
    expect(r).toBeGreaterThan(g);
  });
}
