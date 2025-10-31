import type { Page } from "@playwright/test";

import { expect, test } from "../test";

test.setTimeout(60_000);

async function createEvent(page: Page, eventName: string, startDay: number, endDay: number) {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  await page.keyboard.press("Tab");
  await page.keyboard.type(eventName);

  await page.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", { month: "long" });

  await page.getByRole("button", { name: `${nextMonthName} ${startDay}th` }).click();
  await page.getByRole("button", { name: `${nextMonthName} ${endDay}th` }).click();

  await page.getByText("Create Event").click();

  await expect(page).toHaveURL(/\?id=/);
}

test("footer lists recently visited events and highlights the current event", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Your recent events" })).toHaveCount(0);

  const firstEventName = `footer recents ${Math.random().toString(36).slice(2, 8)}`;
  const START_DAY = 5;
  const END_DAY = 9;

  await createEvent(page, firstEventName, START_DAY, END_DAY);

  const footer = page.locator("footer");
  const firstEventItem = footer.getByRole("listitem").first();

  await expect(footer.getByRole("heading", { name: "Your recent events" })).toBeVisible();
  await expect(firstEventItem).toContainText(firstEventName);
  await expect(firstEventItem).toContainText("(current)");

  const eventUrl = await page.getByLabel("Event URL").first().inputValue();
  const eventId = new URL(eventUrl, "http://127.0.0.1:1999").searchParams.get("id");
  if (!eventId) {
    throw new Error("Event URL did not contain an id");
  }

  await page.goto("/");

  const recentsHeading = page.getByRole("heading", { name: "Your recent events" });
  await expect(recentsHeading).toBeVisible();

  const recentsItems = page.locator("footer ul li");
  await expect(recentsItems.first()).toContainText(firstEventName);
  await expect(recentsItems.first()).not.toContainText("(current)");

  await recentsItems.first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`\\?id=${eventId}`));
  await expect(page.getByRole("heading").first()).toHaveText(firstEventName);

  // Footer should mark the revisited event as current again.
  await expect(page.locator("footer ul li").first()).toContainText("(current)");

  // The rendered dates should match the selected range.
  await expect(
    page.locator(`footer time[dateTime$="-${START_DAY.toString().padStart(2, "0")}"]`).first(),
  ).toBeVisible();
  await expect(
    page.locator(`footer time[dateTime$="-${END_DAY.toString().padStart(2, "0")}"]`).first(),
  ).toBeVisible();
});
