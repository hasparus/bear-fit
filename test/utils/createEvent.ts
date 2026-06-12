import { type Page } from "@playwright/test";

import { expect } from "../index";

function ordinal(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
  return `${day}${suffix}`;
}

/**
 * Creates an event in next month and lands on its page. The canonical helper —
 * specs that need different dates or assertions pass options instead of
 * copy-pasting the flow.
 */
export async function createEvent(
  page: Page,
  {
    endDay = 12,
    name = "test event",
    startDay = 6,
  }: { endDay?: number; name?: string; startDay?: number } = {},
) {
  await page.goto("/");
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  await page.getByLabel("Name your event").fill(name);
  await page.getByRole("button", { name: "next month" }).click();

  const nextMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    1,
  );
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });
  await expect(page.getByText(nextMonthName)).toBeVisible();

  await page
    .getByRole("button", { name: `${nextMonthName} ${ordinal(startDay)}` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} ${ordinal(endDay)}` })
    .click();
  await page.getByText("Create Event").click();

  await expect(page).toHaveURL(/\?id=/);
  await page.getByText("Event dates").waitFor({ state: "visible" });
}
