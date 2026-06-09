import type { Page } from "@playwright/test";

import { expect, test } from "../test";

// A small phone-sized screen. The edit dialog renders a full month calendar
// (`fixedWeeks` always draws 6 rows) plus a label and a submit button, which
// is taller than this viewport. That is exactly the situation from the bug
// report: on mobile the dialog opened partially outside the viewport and,
// because the modal locks body scroll, the clipped parts were unreachable.
test.use({ viewport: { width: 360, height: 400 } });

async function createEventAsCreator(page: Page) {
  await page.goto("/");
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `mobile edit ${Math.random().toString(36).slice(2)}`;
  await page.getByLabel("Name your event").fill(eventName);

  await page.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await page.getByRole("button", { name: `${nextMonthName} 5th` }).click();
  await page.getByRole("button", { name: `${nextMonthName} 10th` }).click();

  await page.getByText("Create Event").click();

  await expect(page.getByRole("heading").first()).toHaveText(eventName);
  await page.getByLabel("Your name").fill("Alice");
}

async function openEditDialog(page: Page) {
  // The edit affordance lives behind Nerd Mode, same as the desktop flow.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByText("Nerd Mode").click();

  await page.getByText("Event dates").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit event dates" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit Event" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("edit dialog fits the viewport and stays usable on a small screen", async ({
  page,
}) => {
  const viewport = page.viewportSize()!;

  await createEventAsCreator(page);
  const dialog = await openEditDialog(page);

  await expect(dialog.getByText("Choose new range")).toBeVisible();

  const title = dialog.getByText("Edit Event");
  const saveButton = dialog.getByRole("button", { name: "Save Changes" });

  // Both ends of the window must be on screen. With the bug the calendar
  // pushed the submit button below the fold, so this is where it fails.
  await expect(title).toBeInViewport();
  await expect(saveButton).toBeInViewport();

  // ...and precisely: nothing is clipped past the top or bottom edge.
  const titleBox = (await title.boundingBox())!;
  const saveBox = (await saveButton.boundingBox())!;
  expect(titleBox.y).toBeGreaterThanOrEqual(-1);
  expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(viewport.height + 1);

  // The whole point: the user can actually save without fighting the scroll.
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(dialog).not.toBeVisible();
});
