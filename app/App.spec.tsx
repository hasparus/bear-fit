import { expect, test } from "@playwright/test";
import fs from "fs/promises";
import * as v from "valibot";

import { AvailabilityKey, CalendarEvent, IsoDate, UserId } from "./schemas";
import { YDocJsonSchema } from "./shared-data";

test("creates a new event, fills dates, opens a new browser and fills more dates", async ({
  browser,
  page: alice,
}) => {
  await alice.goto("/");

  await alice.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `test event ${Math.random().toString(36).substring(2, 15)}`;

  await alice.keyboard.press("Tab");
  await alice.keyboard.type(eventName);

  await alice.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await expect(alice.getByText(nextMonthName)).toBeVisible();

  const START_DAY = 6;
  const END_DAY = 12;
  const CREATOR_NAME = "Alice";

  // Select start and end dates
  await alice
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}th` })
    .click();
  await alice
    .getByRole("button", { name: `${nextMonthName} ${END_DAY}th` })
    .click();

  await alice.getByText("Create Event").click();

  // Verify we're redirected to the event page
  await expect(alice.getByRole("heading")).toHaveText("test event");
  await expect(alice.getByText("Event dates")).toBeVisible();

  // Type creator name
  await alice.keyboard.press("Tab");
  await alice.keyboard.type(CREATOR_NAME);

  // select 6th, 8th, 10th and 11th
  // (yeah, React Day Picker (above) is using custom date formatting for aria  labels, so we have some inconsistencies here)
  await alice
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}` })
    .click();
  await alice.getByRole("button", { name: `${nextMonthName} 8` }).click();
  await alice.getByRole("button", { name: `${nextMonthName} 10` }).click();
  await alice.getByRole("button", { name: `${nextMonthName} 11` }).click();

  // Take note that there's no clipboard isolation, so this could technically  conflict with other tests.
  await alice.getByRole("button", { name: "Copy to clipboard" }).click();
  await expect(alice.getByText("Copied to clipboard")).toBeVisible();

  const url = await alice.getByLabel("Event URL").first().inputValue();
  const eventId = new URL(url).searchParams.get("id");
  if (!eventId) {
    throw new Error("No event ID found");
  }

  await using bobContext = await browser.newContext();
  await using bob = await bobContext.newPage();

  await bob.goto(`/?id=${eventId}`);

  await bob.getByLabel("name").fill("Bob");
  await bob.getByRole("button", { name: `${nextMonthName} 7` }).click();
  await bob.getByRole("button", { name: `${nextMonthName} 11` }).click();

  await alice.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await alice.getByText("Nerd Mode").click();

  const downloadPromise = alice.waitForEvent("download");
  await alice.getByRole("button", { name: "Export to JSON" }).click();
  const download = await downloadPromise;

  // Wait for download to complete
  const path = await download.path();
  if (!path) {
    throw new Error("Download failed or path is null");
  }

  const downloadedJson = await fs.readFile(path, "utf-8");
  await fs.unlink(path);

  const exported = v.parse(YDocJsonSchema, JSON.parse(downloadedJson));

  const event = v.parse(CalendarEvent, exported.event);

  const year = nextMonth.getFullYear();
  const month = (nextMonth.getMonth() + 1).toString().padStart(2, "0");

  {
    // Assert that event metadata matches what we selected in the UI
    expect(event.startDate).toBe(
      `${year}-${month}-${START_DAY.toString().padStart(2, "0")}`,
    );
    expect(event.endDate).toBe(
      `${year}-${month}-${END_DAY.toString().padStart(2, "0")}`,
    );
    expect(event.name).toBe(eventName);
  }

  const names = exported.names;
  const bobId = Object.entries(names).find(([_, name]) => name === "Bob")?.[0];

  if (!bobId) {
    throw new Error("Bob ID not found");
  }

  const creatorId = event.creator;
  const creatorName = names[creatorId];
  expect(creatorName).toBe(CREATOR_NAME);

  {
    // Assert that both Alice and Bob are available on 11th.
    const eleventh = `${year}-${month}-11` as IsoDate;

    expect(
      exported.availability[AvailabilityKey(bobId as UserId, eleventh)],
    ).toBe(true);

    expect(
      exported.availability[AvailabilityKey(creatorId as UserId, eleventh)],
    ).toBe(true);
  }

  // Another user opens the page and copies the event to clipboard.
  const title = bob.getByText(eventName);
  title.dispatchEvent("contextmenu");

  await bob.getByText("Copy event JSON").click();

  const copiedJson = await bob.evaluate(() => navigator.clipboard.readText());

  expect(copiedJson).toBe(downloadedJson);
});
