import { expect, test } from "@playwright/test";
import fs from "fs/promises";
import * as v from "valibot";

import { CalendarEvent } from "./schemas";
import { YDocJsonSchema } from "./shared-data";

test("creates a new event, fills dates, opens a new browser and fills more dates", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  await page.keyboard.press("Tab");
  await page.keyboard.type("test event");

  await page.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await expect(page.getByText(nextMonthName)).toBeVisible();

  const START_DAY = 6;
  const END_DAY = 12;
  const CREATOR_NAME = "Piotr";

  // Select start and end dates
  await page
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}th` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} ${END_DAY}th` })
    .click();

  await page.getByText("Create Event").click();

  // Verify we're redirected to the event page
  await expect(page.getByText("test event")).toBeVisible();
  await expect(page.getByText("Event dates")).toBeVisible();

  // Type creator name
  await page.keyboard.press("Tab");
  await page.keyboard.type(CREATOR_NAME);

  // select 6th, 8th, 10th and 11th
  // (yeah, React Day Picker (above) is using custom date formatting for aria  labels, so we have some inconsistencies here)
  await page
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}` })
    .click();
  await page.getByRole("button", { name: `${nextMonthName} 8` }).click();
  await page.getByRole("button", { name: `${nextMonthName} 10` }).click();
  await page.getByRole("button", { name: `${nextMonthName} 11` }).click();

  // Take note that there's no clipboard isolation, so this could technically  conflict with other tests.
  await page.getByRole("button", { name: "Copy to clipboard" }).click();
  await expect(page.getByText("Copied to clipboard")).toBeVisible();

  const url = await page.getByLabel("Event URL").first().inputValue();
  const eventId = new URL(url).searchParams.get("id");
  if (!eventId) {
    throw new Error("No event ID found");
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to JSON" }).click();
  const download = await downloadPromise;

  // Wait for download to complete
  const path = await download.path();
  if (!path) {
    throw new Error("Download failed or path is null");
  }

  const json = await fs.readFile(path, "utf-8");
  await fs.unlink(path);

  const exported = v.parse(YDocJsonSchema, JSON.parse(json));

  const event = v.parse(CalendarEvent, exported.event);

  expect(event.startDate).toBe(
    `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${START_DAY.toString().padStart(2, "0")}`,
  );
  expect(event.endDate).toBe(
    `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${END_DAY}`,
  );
  expect(event.name).toBe("test event");

  const creatorId = event.creator;

  const names = (exported as { names: Record<string, string> }).names;
  const creatorName = names[creatorId];
  expect(creatorName).toBe(CREATOR_NAME);
});
