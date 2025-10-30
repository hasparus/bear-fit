import fs from "fs/promises";

import { expect, test } from "../test";
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

test("creates an event with a generated name using calendar keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const today = new Date();
  const currentMonthName = today.toLocaleDateString("en-US", {
    month: "long",
  });
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await expect(page.getByText(currentMonthName)).toBeVisible();

  const nextMonthButton = page.getByRole("button", { name: "next month" });
  await nextMonthButton.focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByText(nextMonthName)).toBeVisible();

  const START_DAY = 6;
  const END_DAY = 11;

  const startDayButton = page.getByRole("button", {
    name: `${nextMonthName} ${START_DAY}th`,
  });
  await expect(startDayButton).toBeVisible();
  await startDayButton.focus();
  await page.keyboard.press("Enter");

  const endDayButton = page.getByRole("button", {
    name: `${nextMonthName} ${END_DAY}th`,
  });
  await expect(endDayButton).toBeVisible();
  await endDayButton.focus();
  await page.keyboard.press("Enter");

  const createEventButton = page.getByRole("button", { name: "Create Event" });
  await expect(createEventButton).toBeEnabled();
  await createEventButton.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\?id=/);

  const heading = page.getByRole("heading").first();
  await expect(heading).toBeVisible();

  const generatedName = (await heading.textContent())?.trim() ?? "";
  expect(generatedName.length).toBeGreaterThan(0);
  expect(generatedName).not.toBe("Create a Calendar");

  const words = generatedName.split(" ").filter(Boolean);
  expect(words.length).toBe(3);
  for (const word of words) {
    expect(word).toMatch(/^[A-Z][a-z]+$/);
  }

  const eventUrl = await page.getByLabel("Event URL").first().inputValue();
  expect(eventUrl).toContain("?id=");
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

test("allows dragging to paint and clear availability", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `drag availability ${Math.random().toString(36).slice(2)}`;

  await page.keyboard.press("Tab");
  await page.keyboard.type(eventName);

  await page.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  const START_DAY = 5;
  const END_DAY = 12;

  await page
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}th` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} ${END_DAY}th` })
    .click();

  await page.getByText("Create Event").click();

  await page.getByLabel("Your name").fill("Alice");

  const summaryCount = page.getByRole("definition").first();

  const cells = [6, 7, 8].map((day) =>
    page.getByRole("button", { name: `${nextMonthName} ${day}` }).first(),
  );

  for (const cell of cells) {
    await expect(cell).toBeVisible();
  }

  const positions = await Promise.all(
    cells.map(async (cell) => {
      const box = await cell.boundingBox();
      if (!box) {
        throw new Error("Failed to measure calendar cell");
      }

      return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      };
    }),
  );

  await page.mouse.move(positions[0].x, positions[0].y);
  await page.mouse.down();
  for (const position of positions.slice(1)) {
    await page.mouse.move(position.x, position.y, { steps: 5 });
  }
  await page.mouse.up();

  await expect(summaryCount).toHaveText("3 dates");
  await expect(cells[2]).toBeFocused();

  await page.mouse.move(positions[2].x, positions[2].y);
  await page.mouse.down();
  for (const position of positions.slice(0, 2).reverse()) {
    await page.mouse.move(position.x, position.y, { steps: 5 });
  }
  await page.mouse.up();

  await expect(summaryCount).toHaveText("0 dates");
  await expect(cells[0]).toBeFocused();
});

test("toggles availability with keyboard navigation", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `keyboard availability ${Math.random()
    .toString(36)
    .slice(2)}`;

  await page.keyboard.press("Tab");
  await page.keyboard.type(eventName);

  await page.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  const START_DAY = 4;
  const END_DAY = 12;

  await page
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}th` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} ${END_DAY}th` })
    .click();

  await page.getByText("Create Event").click();

  await page.getByLabel("Your name").fill("Alice");

  const summaryCount = page.getByRole("definition").first();

  const daySix = page
    .getByRole("button", { name: `${nextMonthName} 6` })
    .first();
  const daySeven = page
    .getByRole("button", { name: `${nextMonthName} 7` })
    .first();

  await daySix.focus();
  await expect(daySix).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(summaryCount).toHaveText("1 date");

  await page.keyboard.press("ArrowRight");
  await expect(daySeven).toBeFocused();

  await page.keyboard.press(" ");
  await expect(summaryCount).toHaveText("2 dates");

  await page.keyboard.press("ArrowLeft");
  await expect(daySix).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(summaryCount).toHaveText("1 date");

  await page.keyboard.press("ArrowRight");
  await expect(daySeven).toBeFocused();

  await page.keyboard.press(" ");
  await expect(summaryCount).toHaveText("0 dates");
  await expect(daySeven).toBeFocused();
});

test("gates Nerd Mode tools and persists preference across reloads", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `nerd mode gating ${Math.random()
    .toString(36)
    .slice(2)}`;

  await page.keyboard.press("Tab");
  await page.keyboard.type(eventName);

  await page.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  const START_DAY = 5;
  const END_DAY = 9;

  await page
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}th` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} ${END_DAY}th` })
    .click();

  await page.getByText("Create Event").click();

  await expect(page).toHaveURL(/\?id=/);
  await page.getByText("Event dates").waitFor({ state: "visible" });

  await page.getByLabel("Your name").fill("Alice");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const nerdToggle = page.getByLabel("Nerd Mode");
  const nerdToggleLabel = page.locator('label[for="nerd-mode"]');
  await expect(nerdToggle).not.toBeChecked();

  const exportButton = page.locator('button[title="Export to JSON"]');
  const importControl = page.locator('label[title="Import from JSON"]');

  await expect(
    page.getByRole("button", { name: "Export to JSON" }),
  ).toHaveCount(0);
  await expect(exportButton).toBeHidden();
  await expect(importControl).toBeHidden();

  await nerdToggleLabel.click();

  await expect(nerdToggle).toBeChecked();
  await expect(exportButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Export to JSON" })).toBeVisible();
  await expect(importControl).toBeVisible();

  const eventUrl = await page.getByLabel("Event URL").first().inputValue();

  await page.reload();
  await page.getByText("Event dates").waitFor({ state: "visible" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await expect(page.getByLabel("Nerd Mode")).toBeChecked();
  await expect(page.locator('button[title="Export to JSON"]')).toBeVisible();

  const secondPage = await page.context().newPage();
  await secondPage.goto(eventUrl);
  await secondPage.getByText("Event dates").waitFor({ state: "visible" });
  await secondPage.evaluate(() =>
    window.scrollTo(0, document.body.scrollHeight),
  );

  await expect(secondPage.getByLabel("Nerd Mode")).toBeChecked();
  await expect(
    secondPage.locator('button[title="Export to JSON"]'),
  ).toBeVisible();

  await secondPage.close();
});
