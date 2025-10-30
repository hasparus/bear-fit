import type { Page } from "@playwright/test";

import { expect, test } from "../test";

async function createEvent(page: Page) {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `sharing ui ${Math.random().toString(36).slice(2, 10)}`;
  await page.getByLabel("Name your event").fill(eventName);

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await page.getByRole("button", { name: "next month" }).click();
  await expect(page.getByText(nextMonthName)).toBeVisible();

  const START_DAY = 6;
  const END_DAY = 10;

  await page
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}th` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} ${END_DAY}th` })
    .click();

  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page).toHaveURL(/\?id=/);
  await expect(page.getByRole("heading", { name: eventName })).toBeVisible();

  return { eventName, eventUrl: page.url() };
}

test("copies the event URL from the desktop sharing panel", async ({ page }) => {
  const { eventUrl } = await createEvent(page);

  const urlInput = page.getByLabel("Event URL").first();
  await expect(urlInput).toHaveValue(eventUrl);

  await page.evaluate(() => navigator.clipboard.writeText(""));

  await page.getByRole("button", { name: "Copy to clipboard" }).first().click();
  await expect(page.getByText("Copied to clipboard")).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(eventUrl);
});

test.describe("touch layout sharing UI", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens the touch menu and copies event JSON", async ({ page }) => {
    const { eventName, eventUrl } = await createEvent(page);

    await page.evaluate(() => navigator.clipboard.writeText(""));

    await page.getByRole("button", { name: "Copy to clipboard" }).first().click();
    await expect(page.getByText("Copied to clipboard")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(eventUrl);

    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight }),
    );

    const moreButton = page.getByRole("button", { name: "More actions" });
    await moreButton.click();

    const copyEventJson = page.getByRole("menuitem", {
      name: "Copy event JSON",
    });
    await expect(copyEventJson).toBeVisible();

    await page.evaluate(() => navigator.clipboard.writeText(""));
    await copyEventJson.click();

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain(eventName);

    const clipboardJson = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    const parsed = JSON.parse(clipboardJson);

    expect(parsed.event.name).toBe(eventName);
    expect(parsed.event.id).toBeDefined();
  });
});
