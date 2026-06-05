import { expect, test } from "../test";
import { CalendarEvent } from "./schemas";
import { YDocJsonSchema } from "./shared-data";

test.setTimeout(60_000);

test("creates a rolling event and shows today through the resolved end date", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = `rolling test ${Math.random().toString(36).slice(2)}`;
  await page.getByLabel("Name your event").fill(eventName);

  await page.locator('label[for="is-rolling"]').click();
  await expect(page.locator("#is-rolling")).toBeChecked();

  // Default preset is "Next 2 months" — switch to "Next week" to keep the test
  // tight and avoid month-boundary flakiness when reading day buttons.
  await page.locator("#rolling-window-preset").selectOption("Next week");

  await page.getByText("Create Event").click();

  await expect(page).toHaveURL(/\?id=/);
  await expect(page.getByRole("heading", { name: eventName })).toBeVisible();

  const today = new Date();
  const todayIso = today.toISOString().split("T")[0];
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setUTCDate(sevenDaysLater.getUTCDate() + 7);
  const sevenDaysLaterIso = sevenDaysLater.toISOString().split("T")[0];

  await expect(
    page.locator(`time[dateTime="${todayIso}"]`).first(),
  ).toBeVisible();
  await expect(
    page.locator(`time[dateTime="${sevenDaysLaterIso}"]`).first(),
  ).toBeVisible();
  await expect(page.getByText("Rolling: Next week")).toBeVisible();

  // Capture the event JSON via the export menu to assert the rolling field
  // round-trips through Yjs.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByText("Nerd Mode").click();

  await page
    .getByRole("heading", { name: eventName })
    .dispatchEvent("contextmenu");
  await page.getByRole("menuitem", { name: "Copy event JSON" }).click();

  const copiedJson = await page.evaluate(() => navigator.clipboard.readText());
  const exported = YDocJsonSchema.assert(JSON.parse(copiedJson));
  const event = CalendarEvent.assert(exported.event);

  expect(event.rolling).toEqual({
    end: { days: 7 },
    start: { days: 0 },
  });
  // Rolling events don't store snapshot dates — they're derived at read time.
  expect(event.startDate).toBeUndefined();
  expect(event.endDate).toBeUndefined();
});
