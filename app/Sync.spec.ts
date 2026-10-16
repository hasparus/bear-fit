import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";
import { retryDropped } from "../test/utils/server";

test.setTimeout(60_000);

const OCCUPANCY_ENDPOINT = "/parties/rooms/index";

test("availability marked by one user appears live in another user's grid (Yjs over y-partyserver)", async ({
  browser,
  page: alice,
}) => {
  const eventName = `live sync ${Math.random().toString(36).slice(2, 8)}`;
  const { id, nextMonthName } = await createCalendar(alice, {
    name: eventName,
  });

  await alice.getByLabel("name").fill("Alice");

  await using bobContext = await browser.newContext();
  await using bob = await bobContext.newPage();
  await bob.goto(`/?id=${id}`);
  await bob.getByLabel("name").fill("Bob");

  await alice.getByRole("button", { name: `${nextMonthName} 7` }).click();
  await alice.getByRole("button", { name: `${nextMonthName} 8` }).click();

  const aliceRow = bob.locator("dl div").filter({ hasText: /Alice/ }).first();
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
    const res = await retryDropped(() => request.get(OCCUPANCY_ENDPOINT));
    const info = (await res.json()) as { activeConnections: number };
    return info.activeConnections;
  }

  const eventName = `occupancy ${Math.random().toString(36).slice(2, 8)}`;
  const { id } = await createCalendar(alice, { name: eventName });

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
