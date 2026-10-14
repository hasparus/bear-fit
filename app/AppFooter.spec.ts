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
  await page.route("**/parties/rooms/index", async (route) => {
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

test("footer shows 10 of up to 100 remembered calendars, most recent first", async ({
  page,
}) => {
  const a = await createCalendar(page, { name: "recent a" });
  const b = await createCalendar(page, { name: "recent b" });

  const storedIds = () =>
    page.evaluate(() =>
      (
        JSON.parse(localStorage.getItem("🐻👤state")!).events as {
          id: string;
        }[]
      ).map((calendar) => calendar.id),
    );
  await expect.poll(storedIds).toEqual([b.id, a.id]);

  const seededIds = Array.from({ length: 99 }, (_, i) => `seeded-${i}`);
  await page.evaluate(
    ({ aId, seededIds }) => {
      const state = JSON.parse(localStorage.getItem("🐻👤state")!);
      const calendarA = state.events.find(
        (calendar: { id: string }) => calendar.id === aId,
      );
      state.events = [
        ...seededIds.map((id) => ({ ...calendarA, id, name: id })),
        calendarA,
      ];
      localStorage.setItem("🐻👤state", JSON.stringify(state));
    },
    { aId: a.id, seededIds },
  );

  await page.goto(`/?id=${a.id}`);
  await expect.poll(storedIds).toEqual([a.id, ...seededIds]);

  await page.goto(`/?id=${b.id}`);
  await expect.poll(storedIds).toEqual([b.id, a.id, ...seededIds.slice(0, 98)]);

  const recents = page.locator("footer ul").first().getByRole("listitem");
  await expect(recents).toHaveCount(10);
  await expect(recents.first()).toContainText("recent b (");
  await expect(recents.first()).toContainText("(current)");
  await expect(recents.nth(1)).toContainText("recent a (");
});

test("footer and storage follow date edits of the most recent calendar", async ({
  page,
}) => {
  const { id } = await createCalendar(page, { name: "re-dated" });
  const recent = page.locator("footer ul li").first();
  await expect(recent).toContainText("re-dated (");
  await expect(recent).not.toContainText("rolling");

  await page.getByText("Dates", { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit dates" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Calendar" });
  await dialog.getByText("Rolling window", { exact: true }).click();
  await dialog.getByRole("button", { name: "Save Changes" }).click();

  await expect(recent).toContainText(", rolling)");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("🐻👤state")!).events[0],
      ),
    )
    .toMatchObject({ id, name: "re-dated", rolling: expect.any(Number) });
});

test("footer paints stored calendars on the first render and doesn't rewrite them on load", async ({
  page,
}) => {
  const stored = {
    id: "stored",
    creator: "someone",
    name: "stored one",
    rolling: 7,
  };
  await page.addInitScript((calendar) => {
    const key = "🐻👤state";
    localStorage.setItem(
      key,
      JSON.stringify({ events: [calendar], nerdMode: false }),
    );

    const writes: unknown[] = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (k === key) writes.push(JSON.parse(value));
      setItem.call(this, k, value);
    };

    let firstFooterText: string | null = null;
    new MutationObserver((_, observer) => {
      const footer = document.querySelector("footer");
      if (!footer) return;
      firstFooterText = footer.textContent;
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });

    Object.assign(window, {
      userStateLoad: () => ({ firstFooterText, writes }),
    });
  }, stored);
  await page.goto("/");

  await page.locator('label[for="nerd-mode"]').click();
  await expect(page.getByLabel("Nerd Mode")).toBeChecked();

  const { firstFooterText, writes } = await page.evaluate(() =>
    (
      window as unknown as {
        userStateLoad: () => { firstFooterText: string; writes: unknown[] };
      }
    ).userStateLoad(),
  );
  expect(firstFooterText).toContain("stored one");
  expect(writes).toEqual([{ events: [stored], nerdMode: true }]);
});
