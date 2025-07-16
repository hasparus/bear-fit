import { expect, test } from "@playwright/test";
import fs from "fs/promises";

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
  await expect(alice.getByRole("heading").first()).toHaveText(eventName);
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

  const exported = YDocJsonSchema.assert(JSON.parse(downloadedJson));
  const event = CalendarEvent.assert(exported.event);

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
  const title = bob.getByRole("heading", { name: new RegExp(eventName) });
  title.dispatchEvent("contextmenu");

  await bob.getByText("Copy event JSON").click();

  const copiedJson = await bob.evaluate(() => navigator.clipboard.readText());

  expect(copiedJson).toBe(downloadedJson);
});

test("edits event dates and preserves user availability", async ({
  browser,
  page: alice,
}) => {
  await alice.goto("/");

  await alice.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `edit test event ${Math.random().toString(36).substring(2, 15)}`;

  await alice.keyboard.press("Tab");
  await alice.keyboard.type(eventName);

  await alice.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await expect(alice.getByText(nextMonthName)).toBeVisible();

  // Initial date range: 5th to 10th
  const INITIAL_START_DAY = 5;
  const INITIAL_END_DAY = 10;

  // New date range after edit: 3rd to 15th (expanding the range)
  const NEW_START_DAY = 3;
  const NEW_END_DAY = 15;

  const CREATOR_NAME = "Alice";

  // Select initial start and end dates
  await alice
    .getByRole("button", { name: `${nextMonthName} ${INITIAL_START_DAY}th` })
    .click();
  await alice
    .getByRole("button", { name: `${nextMonthName} ${INITIAL_END_DAY}th` })
    .click();

  await alice.getByText("Create Event").click();

  // Verify we're redirected to the event page
  await expect(alice.getByRole("heading").first()).toHaveText(eventName);
  await expect(alice.getByText("Event dates")).toBeVisible();

  // Type creator name
  await alice.keyboard.press("Tab");
  await alice.keyboard.type(CREATOR_NAME);

  // Add some availability in the initial range (6th, 7th, 8th)
  await alice.getByRole("button", { name: `${nextMonthName} 6` }).click();
  await alice.getByRole("button", { name: `${nextMonthName} 7` }).click();
  await alice.getByRole("button", { name: `${nextMonthName} 8` }).click();

  // Verify initial dates are displayed using time elements
  const year = nextMonth.getFullYear();
  const month = (nextMonth.getMonth() + 1).toString().padStart(2, "0");
  const initialStartDateIso = `${year}-${month}-${INITIAL_START_DAY.toString().padStart(2, "0")}`;
  const initialEndDateIso = `${year}-${month}-${INITIAL_END_DAY.toString().padStart(2, "0")}`;

  await expect(
    alice.locator(`time[dateTime="${initialStartDateIso}"]`).first(),
  ).toBeVisible();
  await expect(
    alice.locator(`time[dateTime="${initialEndDateIso}"]`).first(),
  ).toBeVisible();

  // Enable Nerd Mode to access edit functionality
  await alice.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await alice.getByText("Nerd Mode").click();

  await alice.getByText("Event dates").click({ button: "right" });
  await alice.getByRole("menuitem", { name: "Edit event dates" }).click();

  // Verify edit dialog is open
  await expect(alice.getByText("Edit Event")).toBeVisible();
  await expect(alice.getByText("Choose new range")).toBeVisible();

  await alice.getByRole("button", { name: "Go to the Next Month" }).click();

  // Change the date
  await alice
    .getByRole("button", { name: `${nextMonthName} ${NEW_START_DAY}rd` })
    .click();
  await alice
    .getByRole("button", { name: `${nextMonthName} ${NEW_END_DAY}th` })
    .click();

  // Save changes
  await alice.getByRole("button", { name: "Save Changes" }).click();

  // Verify dialog is closed and new dates are displayed
  await expect(alice.getByText("Edit Event")).not.toBeVisible();

  // Verify that the new dates are visible in the calendar grid
  await expect(
    alice.getByRole("button", { name: `${nextMonthName} ${NEW_START_DAY}` }),
  ).toBeVisible();
  await expect(
    alice.getByRole("button", { name: `${nextMonthName} ${NEW_END_DAY}` }),
  ).toBeVisible();

  // Verify old availability is preserved (should still see filled 6th, 7th, 8th)
  const sixthButton = alice.getByRole("button", { name: `${nextMonthName} 6` });
  const seventhButton = alice.getByRole("button", {
    name: `${nextMonthName} 7`,
  });
  const eighthButton = alice.getByRole("button", {
    name: `${nextMonthName} 8`,
  });

  // These should still be marked as available (have specific styling)
  await expect(sixthButton).toBeVisible();
  await expect(seventhButton).toBeVisible();
  await expect(eighthButton).toBeVisible();

  // Get the event URL for Bob to join
  const url = await alice.getByLabel("Event URL").first().inputValue();
  const eventId = new URL(url).searchParams.get("id");
  if (!eventId) {
    throw new Error("No event ID found");
  }

  // Create second user (Bob) to test collaborative editing
  await using bobContext = await browser.newContext();
  await using bob = await bobContext.newPage();

  await bob.goto(`/?id=${eventId}`);

  // Bob adds his name
  await bob.getByLabel("name").fill("Bob");

  // Both Alice and Bob should see the new date range using time elements
  const newStartDateIso = `${year}-${month}-${NEW_START_DAY.toString().padStart(2, "0")}`;
  const newEndDateIso = `${year}-${month}-${NEW_END_DAY.toString().padStart(2, "0")}`;

  // Verify Alice sees the new dates
  await expect(
    alice.locator(`time[dateTime="${newStartDateIso}"]`).first(),
  ).toBeVisible();
  await expect(
    alice.locator(`time[dateTime="${newEndDateIso}"]`).first(),
  ).toBeVisible();

  // Verify Bob sees the new dates
  await expect(
    bob.locator(`time[dateTime="${newStartDateIso}"]`).first(),
  ).toBeVisible();
  await expect(
    bob.locator(`time[dateTime="${newEndDateIso}"]`).first(),
  ).toBeVisible();

  // Verify both users can see the expanded calendar range
  await expect(
    alice.getByRole("button", { name: `${nextMonthName} ${NEW_START_DAY}` }),
  ).toBeVisible();
  await expect(
    alice.getByRole("button", { name: `${nextMonthName} ${NEW_END_DAY}` }),
  ).toBeVisible();

  await expect(
    bob.getByRole("button", { name: `${nextMonthName} ${NEW_START_DAY}` }),
  ).toBeVisible();
  await expect(
    bob.getByRole("button", { name: `${nextMonthName} ${NEW_END_DAY}` }),
  ).toBeVisible();
});
