import { expect, test } from "../test";
import { addDays, CalendarEvent, isoDate, startOfTodayUtc } from "./schemas";
import { YDocJsonSchema } from "./shared-data";

test.setTimeout(60_000);

test("creates a rolling event and shows today through the resolved end date", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  const eventName = "rolling test";
  await page.getByLabel("Name your event").fill(eventName);

  const today = startOfTodayUtc();
  const sevenDaysLater = addDays(today, 7);

  const formatCalendarDay = (date: Date) => {
    const month = date.toLocaleDateString("en-US", {
      month: "long",
      timeZone: "UTC",
    });
    const day = date.getUTCDate();
    const suffix =
      day % 10 === 1 && day !== 11
        ? "st"
        : day % 10 === 2 && day !== 12
          ? "nd"
          : day % 10 === 3 && day !== 13
            ? "rd"
            : "th";
    return `${month} ${day}${suffix}`;
  };

  await page
    .getByRole("button", { name: formatCalendarDay(today) })
    .click();
  await page
    .getByRole("button", { name: formatCalendarDay(sevenDaysLater) })
    .click();

  await page.getByText("Rolling window", { exact: true }).click();
  await expect(page.getByLabel("Rolling window")).toBeChecked();

  await page.getByText("Create Event").click();

  await expect(page).toHaveURL(/\?id=/);
  await expect(page.getByRole("heading", { name: eventName })).toBeVisible();

  const todayIso = isoDate(today);
  const sevenDaysLaterIso = isoDate(sevenDaysLater);
  // Format expected dates in the browser context so they match the UI's
  const [todayDisplay, sevenDaysLaterDisplay] = await page.evaluate(
    ([t, s]) => [
      new Date(t).toLocaleDateString(undefined, { timeZone: "UTC" }),
      new Date(s).toLocaleDateString(undefined, { timeZone: "UTC" }),
    ],
    [todayIso, sevenDaysLaterIso] as const,
  );
  const eventDateRange = page.getByText("Event dates").locator("+ p");

  await expect(eventDateRange).toContainText(todayDisplay);
  await expect(eventDateRange).toContainText(sevenDaysLaterDisplay);
  await expect(eventDateRange.getByText("Rolling: 7 days")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByText("Nerd Mode").click();

  await page
    .getByRole("heading", { name: eventName })
    .dispatchEvent("contextmenu");
  await page.getByRole("menuitem", { name: "Copy event JSON" }).click();

  const copiedJson = await page.evaluate(() => navigator.clipboard.readText());
  const exported = YDocJsonSchema.assert(JSON.parse(copiedJson));
  const event = CalendarEvent.assert(exported.event);

  expect(event.rolling).toBe(7);
  expect(event.startDate).toBeUndefined();
  expect(event.endDate).toBeUndefined();
});
