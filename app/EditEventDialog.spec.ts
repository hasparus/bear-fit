import type { Page } from "@playwright/test";

import { expect, test } from "../test";

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

  await page.getByText("Create Calendar").click();

  await expect(page.getByRole("heading").first()).toHaveText(eventName);
  await page.getByLabel("Your name").fill("Alice");
}

async function openEditDialog(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByText("Nerd Mode").click();

  await page.getByText("Dates").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit dates" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit Calendar" });
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

  const title = dialog.getByText("Edit Calendar");
  const saveButton = dialog.getByRole("button", { name: "Save Changes" });

  await expect(title).toBeInViewport();
  await expect(saveButton).toBeInViewport();

  const titleBox = (await title.boundingBox())!;
  const saveBox = (await saveButton.boundingBox())!;
  expect(titleBox.y).toBeGreaterThanOrEqual(-1);
  expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(viewport.height + 1);

  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(dialog).not.toBeVisible();
});
