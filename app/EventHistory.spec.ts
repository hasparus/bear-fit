import type { Page } from "@playwright/test";

import fs from "fs/promises";
import * as Y from "yjs";

import { expect, test } from "../test";
import { AvailabilityKey, type IsoDate, type UserId } from "./schemas";
import { YDocJsonSchema, yDocToJson } from "./shared-data";
import { getUpdatesFromUint8Array } from "./ui/EventHistory/getUpdatesFromUint8Array";

const CLOCK_ICON_PATH =
  "M19 3H5v2H3v14h2v2h14v-2h2V5h-2V3zm0 2v14H5V5h14zm-8 2h2v6h4v2h-6V7z";
const CREATOR_NAME = "Alice";
const CREATOR_START_DAY = 6;
const CREATOR_END_DAY = 11;
const TARGET_DAY = 9;

test.describe.configure({ mode: "serial" });

async function createEvent(page: Page) {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `event history ${Math.random().toString(36).slice(2)}`;

  await page.keyboard.press("Tab");
  await page.keyboard.type(eventName);

  await page.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await page
    .getByRole("button", { name: `${nextMonthName} ${CREATOR_START_DAY}th` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} ${CREATOR_END_DAY}th` })
    .click();

  await page.getByText("Create Event").click();

  await expect(page.getByRole("heading").first()).toHaveText(eventName);
  await expect(page).toHaveURL(/\?id=/);

  await page.keyboard.press("Tab");
  await page.keyboard.type(CREATOR_NAME);

  const url = new URL(page.url());
  const eventId = url.searchParams.get("id");

  if (!eventId) {
    throw new Error("Event ID missing from URL");
  }

  const year = nextMonth.getFullYear();
  const month = (nextMonth.getMonth() + 1).toString().padStart(2, "0");
  const targetIsoDate =
    `${year}-${month}-${TARGET_DAY.toString().padStart(2, "0")}` as IsoDate;

  return {
    eventId,
    eventName,
    nextMonth,
    targetIsoDate,
  };
}

async function enableNerdMode(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByText("Nerd Mode").click();
  await expect(
    page.getByRole("button", { name: "Export to JSON" }),
  ).toBeVisible();
}

async function exportEventJson(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error("Download path not available");
  }
  const contents = await fs.readFile(path, "utf-8");
  await fs.unlink(path);
  return contents;
}

async function availabilityLabel(page: Page, date: Date) {
  return page.evaluate(
    (timestamp) =>
      new Date(timestamp).toLocaleDateString(undefined, {
        dateStyle: "full",
      }),
    date.toISOString(),
  );
}

async function availabilityCell(page: Page, date: Date) {
  const label = await availabilityLabel(page, date);
  return page.getByRole("button", { name: label });
}

async function toggleAvailability(page: Page, date: Date) {
  const cell = await availabilityCell(page, date);
  await expect(cell).toBeVisible();
  await cell.click();
}

async function availabilityFill(page: Page, date: Date) {
  const cell = await availabilityCell(page, date);
  return cell.evaluate((node) => getComputedStyle(node).backgroundColor);
}

async function openEventHistory(page: Page) {
  const trigger = page
    .locator("button")
    .filter({
      has: page.locator(`svg path[d="${CLOCK_ICON_PATH}"]`),
    })
    .first();

  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Version History" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("creator can restore an event version", async ({ page: alice }) => {
  const { nextMonth, targetIsoDate } = await createEvent(alice);

  await enableNerdMode(alice);

  const initialJson = await exportEventJson(alice);
  const initialData = YDocJsonSchema.assert(JSON.parse(initialJson));

  const targetDate = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    TARGET_DAY,
  );
  const initialFill = await availabilityFill(alice, targetDate);

  const noiseDate = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    TARGET_DAY + 1,
  );
  for (let i = 0; i < 3; i++) {
    await toggleAvailability(alice, noiseDate);
    await toggleAvailability(alice, noiseDate);
  }

  await alice.waitForTimeout(200);
  await toggleAvailability(alice, targetDate);
  const changedFill = await availabilityFill(alice, targetDate);
  expect(changedFill).not.toBe(initialFill);

  const changedJson = await exportEventJson(alice);
  const changedData = YDocJsonSchema.assert(JSON.parse(changedJson));

  const creatorId = changedData.event.creator as UserId;
  const availabilityKey = AvailabilityKey(creatorId, targetIsoDate);
  expect(changedData.availability[availabilityKey]).toBe(true);

  const historyResponse = await fetch(
    `http://127.0.0.1:1999/parties/main/${changedData.event.id}/history`,
  );
  if (!historyResponse.ok) {
    throw new Error(`Failed to fetch history: ${historyResponse.status}`);
  }
  const historyBuffer = new Uint8Array(await historyResponse.arrayBuffer());

  const updates = getUpdatesFromUint8Array(historyBuffer);
  const restoreIndex = (() => {
    const doc = new Y.Doc();
    let candidate = -1;
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      if (update.value) {
        Y.applyUpdate(doc, update.value);
      }
      const snapshot = yDocToJson(doc);
      const hasAvailability = snapshot.availability[availabilityKey] === true;
      if (!hasAvailability) {
        candidate = i;
      }
    }
    return candidate;
  })();

  if (restoreIndex < 0 || restoreIndex === updates.length - 1) {
    throw new Error(
      "Unable to identify an older snapshot without creator availability",
    );
  }

  const historyDialog = await openEventHistory(alice);
  const slider = historyDialog.locator('input[type="range"]');
  await slider.waitFor();
  await expect(slider).toBeEnabled();

  const sliderMinAttr = await slider.getAttribute("min");
  const sliderMin = sliderMinAttr ? Number(sliderMinAttr) : 0;
  const sliderTarget = Math.max(sliderMin, restoreIndex);

  const currentValue = await slider.evaluate((element) =>
    Number((element as HTMLInputElement).value),
  );
  const steps = currentValue - sliderTarget;
  if (steps > 0) {
    await slider.focus();
    for (let i = 0; i < steps; i++) {
      await alice.keyboard.press("ArrowLeft");
    }
  }

  await alice.waitForTimeout(300);

  await historyDialog.evaluate(() => {
    const checkbox = document.getElementById(
      "show-data",
    ) as HTMLInputElement | null;
    if (checkbox && !checkbox.checked) {
      checkbox.click();
    }
  });

  const selectedSnapshot = (() => {
    const doc = new Y.Doc();
    for (let i = 0; i <= restoreIndex; i++) {
      const update = updates[i];
      if (update.value) {
        Y.applyUpdate(doc, update.value);
      }
    }
    return YDocJsonSchema.assert(yDocToJson(doc));
  })();
  const uiSnapshot = await historyDialog
    .locator("pre")
    .first()
    .evaluate((node) => node.textContent ?? "");
  const parsedUiSnapshot =
    uiSnapshot.trim().length > 0
      ? YDocJsonSchema.assert(JSON.parse(uiSnapshot))
      : undefined;
  expect(parsedUiSnapshot?.availability[availabilityKey]).toBeUndefined();
  expect(selectedSnapshot.availability[availabilityKey]).toBeUndefined();

  const restoreButton = historyDialog.getByRole("button", {
    name: "Restore This Version",
  });
  await expect(restoreButton).toBeEnabled();
  await restoreButton.click();

  await expect(historyDialog).not.toBeVisible();

  await alice.waitForTimeout(500);

  const restoredJson = await exportEventJson(alice);
  const restoredData = YDocJsonSchema.assert(JSON.parse(restoredJson));

  expect(restoredData.availability[availabilityKey]).toBeUndefined();
  expect(restoredData.availability).toEqual(selectedSnapshot.availability);
  expect(restoredData.event).toEqual(selectedSnapshot.event);
  expect(restoredData.event).toEqual(initialData.event);
  expect(restoredData.availability).toEqual(initialData.availability);
});

test("non-creator cannot restore an event version", async ({
  browser,
  page: alice,
}) => {
  const { eventId, nextMonth, targetIsoDate } = await createEvent(alice);

  await enableNerdMode(alice);

  const targetDate = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    TARGET_DAY,
  );
  await toggleAvailability(alice, targetDate);

  await alice.waitForTimeout(200);

  const afterChangeJson = await exportEventJson(alice);
  const afterChangeData = YDocJsonSchema.assert(JSON.parse(afterChangeJson));
  const creatorId = afterChangeData.event.creator as UserId;
  const availabilityKey = AvailabilityKey(creatorId, targetIsoDate);
  expect(afterChangeData.availability[availabilityKey]).toBe(true);

  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();

  try {
    await bob.goto(`/?id=${eventId}`);
    await bob.getByLabel("name").fill("Bob");

    await enableNerdMode(bob);

    const historyDialog = await openEventHistory(bob);
    const restoreButtons = historyDialog.getByRole("button", {
      name: "Restore This Version",
    });
    await expect(restoreButtons).toHaveCount(0);

    await historyDialog.getByLabel("Close").click();
  } finally {
    await bobContext.close();
  }

  await alice.waitForTimeout(200);

  const finalJson = await exportEventJson(alice);
  const finalData = YDocJsonSchema.assert(JSON.parse(finalJson));
  expect(finalData.availability[availabilityKey]).toBe(true);
});
