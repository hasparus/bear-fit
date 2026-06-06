import type { Page } from "@playwright/test";

import { expect, test } from "../test";

test.setTimeout(60_000);

const OCCUPANCY_ENDPOINT = "/parties/rooms/index";

/**
 * Creates an event as `page` and returns its id. Mirrors the helpers in the
 * other specs but is local to keep this file self-contained.
 */
async function createEvent(page: Page, eventName: string) {
  await page.goto("/");

  await page.getByText("Create a Calendar").waitFor({ state: "visible" });

  await page.keyboard.press("Tab");
  await page.keyboard.type(eventName);

  await page.getByRole("button", { name: "next month" }).click();

  const nextMonth = new Date();
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await page
    .getByRole("button", { name: `${nextMonthName} 6th` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} 12th` })
    .click();

  await page.getByText("Create Event").click();
  await expect(page).toHaveURL(/\?id=/);

  const id = new URL(page.url()).searchParams.get("id");
  if (!id) {
    throw new Error("Event id missing from URL");
  }

  return { id, nextMonthName };
}

test("availability marked by one user appears live in another user's grid (Yjs over y-partyserver)", async ({
  browser,
  page: alice,
}) => {
  const eventName = `live sync ${Math.random().toString(36).slice(2, 8)}`;
  const { id, nextMonthName } = await createEvent(alice, eventName);

  await alice.getByLabel("name").fill("Alice");

  await using bobContext = await browser.newContext();
  await using bob = await bobContext.newPage();
  await bob.goto(`/?id=${id}`);
  await bob.getByLabel("name").fill("Bob");

  await alice.getByRole("button", { name: `${nextMonthName} 7` }).click();
  await alice.getByRole("button", { name: `${nextMonthName} 8` }).click();

  const aliceRow = bob
    .locator("dl div")
    .filter({ hasText: /Alice/ })
    .first();
  await expect(aliceRow).toContainText("2 dates");

  await bob.getByRole("button", { name: `${nextMonthName} 9` }).click();
  const bobRowOnAlice = alice
    .locator("dl div")
    .filter({ hasText: /Bob/ })
    .first();
  await expect(bobRowOnAlice).toContainText("1 date");
});

test("opening an event connection updates occupancy, and closing it drains again (cross-DO lifecycle)", async ({
  browser,
  page: alice,
  request,
}) => {
  async function activeConnections() {
    const res = await request.get(OCCUPANCY_ENDPOINT);
    const info = (await res.json()) as { activeConnections: number };
    return info.activeConnections;
  }

  const eventName = `occupancy ${Math.random().toString(36).slice(2, 8)}`;
  const { id } = await createEvent(alice, eventName);

  await using guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/?id=${id}`);

  await expect
    .poll(activeConnections, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);

  const whileOpen = await activeConnections();

  await guest.close();

  await expect
    .poll(activeConnections, { timeout: 15_000 })
    .toBeLessThan(whileOpen);
});
