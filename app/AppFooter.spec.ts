import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";

test.setTimeout(60_000);

test("footer lists recently visited events and highlights the current event", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Your recent calendars" }),
  ).toHaveCount(0);

  const firstEventName = `footer recents ${Math.random().toString(36).slice(2, 8)}`;
  const START_DAY = 5;
  const END_DAY = 9;

  await createCalendar(page, {
    endDay: END_DAY,
    name: firstEventName,
    startDay: START_DAY,
  });

  const footer = page.locator("footer");
  const firstEventItem = footer.getByRole("listitem").first();

  await expect(
    footer.getByRole("heading", { name: "Your recent calendars" }),
  ).toBeVisible();
  await expect(firstEventItem).toContainText(firstEventName);
  await expect(firstEventItem).toContainText("(current)");

  const eventUrl = await page.getByLabel("Calendar URL").first().inputValue();
  const eventId = new URL(eventUrl).searchParams.get("id");
  if (!eventId) {
    throw new Error("Event URL did not contain an id");
  }

  await page.goto("/");

  const recentsHeading = page.getByRole("heading", {
    name: "Your recent calendars",
  });
  await expect(recentsHeading).toBeVisible();

  const recentsItems = page.locator("footer ul li");
  await expect(recentsItems.first()).toContainText(firstEventName);
  await expect(recentsItems.first()).not.toContainText("(current)");

  await recentsItems.first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`\\?id=${eventId}`));
  await expect(page.getByRole("heading").first()).toHaveText(firstEventName);

  // Footer should mark the revisited event as current again.
  await expect(page.locator("footer ul li").first()).toContainText("(current)");

  // The rendered dates should match the selected range.
  await expect(
    page
      .locator(
        `footer time[dateTime$="-${START_DAY.toString().padStart(2, "0")}"]`,
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .locator(
        `footer time[dateTime$="-${END_DAY.toString().padStart(2, "0")}"]`,
      )
      .first(),
  ).toBeVisible();
});

test("a calendar paints without waiting for the footer stats", async ({
  page,
}) => {
  const name = `paint first ${Math.random().toString(36).slice(2, 8)}`;
  const { id, nextMonthName } = await createCalendar(page, { name });

  let releaseStats!: () => void;
  const statsHeld = new Promise<void>((resolve) => (releaseStats = resolve));
  await page.route("**/parties/rooms/**", async (route) => {
    await statsHeld;
    await route.continue();
  });
  await page.goto(`/?id=${id}`);

  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${nextMonthName} 6` }),
  ).toBeVisible();

  releaseStats();
  await expect(page.getByText(/Calendars? created/)).toBeVisible();
});
