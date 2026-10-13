import type { APIRequestContext, Page, Request } from "@playwright/test";

import { expect, test } from "../test";
import { createCalendar, fillCreateForm } from "../test/utils/createCalendar";
import { decodeHistoryUpdates } from "./decodeHistoryUpdates";

test.setTimeout(60_000);

const randomName = (prefix: string) =>
  `${prefix} ${Math.random().toString(36).slice(2, 8)}`;

const isCreationPost = (request: Request) =>
  request.method() === "POST" && request.url().includes("/parties/main/");

/** The server's reply to a client's sync step 1, carrying its whole state. */
const isSyncStep2 = ({ payload }: { payload: Buffer | string }) =>
  typeof payload !== "string" && payload[0] === 0 && payload[1] === 1;

async function serverDoc(request: APIRequestContext, id: string) {
  const res = await request.get(`/parties/main/${id}`);
  return (await res.json()) as {
    availability: Record<string, boolean>;
    event: Record<string, unknown>;
    names: Record<string, string>;
  };
}

async function historyLength(request: APIRequestContext, id: string) {
  const res = await request.get(`/parties/main/${id}/history`);
  return decodeHistoryUpdates(await res.body()).length;
}

async function serverEventName(request: APIRequestContext, id: string) {
  return (await serverDoc(request, id)).event.name;
}

/**
 * Connects the page's sync WebSockets to the server only once `gate()`
 * resolves. Must run before the page loads.
 */
async function gateSync(page: Page, gate: () => Promise<void>) {
  await page.routeWebSocket(/\/parties\/main\//, async (ws) => {
    await gate();
    ws.connectToServer();
  });
}

/** Holds the page's creation POST until the returned function is called. */
async function holdCreationPost(page: Page) {
  const post = deferred();
  await page.route("**/parties/main/*", async (route) => {
    if (!isCreationPost(route.request())) return route.fallback();
    await post.promise;
    await route.continue();
  });
  return post.resolve;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

async function importCalendarJson(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByText("Nerd Mode").click();
  await page
    .locator("#import-json")
    .first()
    .setInputFiles({
      mimeType: "application/json",
      name: "imported.json",
      buffer: Buffer.from(
        JSON.stringify({
          availability: {},
          names: {},
          event: {
            id: "imported",
            creator: "imported-user",
            endDate: "2099-01-10",
            name,
            startDate: "2099-01-05",
          },
        }),
      ),
    });
  await expect(page.getByRole("heading").first()).toHaveText(name);
}

test("the creation POST alone delivers a calendar the user left right away", async ({
  page,
  request,
}) => {
  await gateSync(page, () => deferred().promise);
  const releasePost = await holdCreationPost(page);
  const name = randomName("left right away");
  const { id } = await createCalendar(page, { name });
  await page.goto("about:blank");
  releasePost();

  await expect.poll(() => serverEventName(request, id)).toBe(name);
});

for (const failure of ["network error", "server error"] as const) {
  test(`sync delivers the calendar when the creation POST hits a ${failure}`, async ({
    browser,
    page,
    request,
  }) => {
    await page.route("**/parties/main/*", (route) => {
      if (!isCreationPost(route.request())) return route.fallback();
      return failure === "network error"
        ? route.abort()
        : route.fulfill({ status: 500 });
    });
    const name = randomName("post fails");
    const { id } = await createCalendar(page, { name });

    await using guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(`/?id=${id}`);
    await expect(guest.getByRole("heading").first()).toHaveText(name);
    expect(await serverEventName(request, id)).toBe(name);
  });
}

test("double-clicking Create makes a single calendar", async ({
  page,
  request,
}) => {
  const posts: Request[] = [];
  page.on("request", (req) => isCreationPost(req) && posts.push(req));
  await page.goto("/");
  const name = randomName("double submit");
  await fillCreateForm(page, { name });
  await page.getByRole("button", { name: "Create Calendar" }).dblclick();

  await expect(page.getByRole("heading").first()).toHaveText(name);
  const id = new URL(page.url()).searchParams.get("id")!;
  await expect.poll(() => serverEventName(request, id)).toBe(name);
  expect(posts.map((req) => req.url())).toEqual([
    expect.stringContaining(`/parties/main/${id}`),
  ]);
});

test("reloading while the calendar is being created keeps it", async ({
  page,
  request,
}) => {
  const sync = deferred();
  await gateSync(page, () => sync.promise);
  const releasePost = await holdCreationPost(page);
  const name = randomName("reload");
  const { id } = await createCalendar(page, { name });

  await page.reload();
  releasePost();
  await expect.poll(() => serverEventName(request, id)).toBe(name);
  sync.resolve();
  await expect(page.getByRole("heading").first()).toHaveText(name);
});

test("two tabs of the creator edit the same calendar and converge", async ({
  context,
  page,
  request,
}) => {
  const name = randomName("two tabs");
  const { id, nextMonthName } = await createCalendar(page, { name });
  const second = await context.newPage();
  await second.goto(`/?id=${id}`);
  await expect(second.getByRole("heading").first()).toHaveText(name);

  await page.getByLabel("Your name").fill("Alice");
  await page.getByRole("button", { name: `${nextMonthName} 7` }).click();
  await second.getByRole("button", { name: `${nextMonthName} 8` }).click();

  for (const tab of [page, second]) {
    await expect(
      tab.locator("dl div").filter({ hasText: /Alice/ }).first(),
    ).toContainText("2 dates");
  }
  await expect
    .poll(async () => {
      const { availability, event, names } = await serverDoc(request, id);
      return {
        dates: Object.keys(availability).length,
        name: event.name,
        names: Object.values(names),
      };
    })
    .toEqual({ dates: 2, name, names: ["Alice"] });
});

test("edits made before the first sync aren't reverted by the creation", async ({
  page,
  request,
}) => {
  const sync = deferred();
  await gateSync(page, () => sync.promise);
  const { id } = await createCalendar(page, { name: randomName("early") });
  await expect.poll(() => serverEventName(request, id)).toBeTruthy();

  const imported = randomName("imported");
  await importCalendarJson(page, imported);
  sync.resolve();

  await expect.poll(() => serverEventName(request, id)).toBe(imported);
  await expect(page.getByRole("heading").first()).toHaveText(imported);
});

test("an import reaches the server as a single update", async ({
  page,
  request,
}) => {
  const name = randomName("single update");
  const { id } = await createCalendar(page, { name });
  await expect.poll(() => serverEventName(request, id)).toBe(name);
  const before = await historyLength(request, id);

  const imported = randomName("imported");
  await importCalendarJson(page, imported);

  await expect.poll(() => serverEventName(request, id)).toBe(imported);
  expect(await historyLength(request, id)).toBe(before + 1);
});

test("a late or replayed creation POST doesn't revert later edits", async ({
  browser,
  page,
  request,
}) => {
  const releasePost = await holdCreationPost(page);
  const { id } = await createCalendar(page, { name: randomName("late") });

  await using guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/?id=${id}`);

  const imported = randomName("imported");
  await importCalendarJson(page, imported);
  await expect(guest.getByRole("heading").first()).toHaveText(imported);

  const response = page.waitForResponse((res) => isCreationPost(res.request()));
  releasePost();
  expect((await response).ok()).toBe(true);
  const replay = await request.post(`/parties/main/${id}`, {
    data: (await response).request().postDataBuffer(),
  });
  expect(replay.ok()).toBe(true);

  expect(await serverEventName(request, id)).toBe(imported);
  await expect(guest.getByRole("heading").first()).toHaveText(imported);
});

test("a guest who opens the link before the calendar lands gets it live", async ({
  browser,
  page,
}) => {
  await gateSync(page, () => deferred().promise);
  const releasePost = await holdCreationPost(page);
  const name = randomName("early guest");
  const { id } = await createCalendar(page, { name });

  await using guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  const synced = guest
    .waitForEvent("websocket", (ws) => ws.url().includes(id))
    .then((ws) => ws.waitForEvent("framereceived", isSyncStep2));
  await guest.goto(`/?id=${id}`);
  await synced;
  await expect(guest.getByRole("heading", { name })).toHaveCount(0);

  releasePost();
  await expect(guest.getByRole("heading").first()).toHaveText(name);
});

test("a calendar created after going back starts from a clean doc", async ({
  page,
  request,
}) => {
  let sync = Promise.resolve();
  await gateSync(page, () => sync);
  const { id: firstId, nextMonthName } = await createCalendar(page, {
    name: randomName("first"),
  });
  await page.getByRole("button", { name: `${nextMonthName} 7` }).click();
  await expect
    .poll(async () => (await serverDoc(request, firstId)).availability)
    .not.toEqual({});

  await page.goBack();
  const secondSync = deferred();
  sync = secondSync.promise;
  const second = randomName("second");
  await fillCreateForm(page, { name: second });
  const creation = page.waitForRequest(isCreationPost);
  await page.getByRole("button", { name: "Create Calendar" }).click();
  const secondId = new URL((await creation).url()).pathname.split("/").pop()!;

  await expect.poll(() => serverEventName(request, secondId)).toBe(second);
  secondSync.resolve();
  await expect(page.getByRole("heading").first()).toHaveText(second);
  await page.getByLabel("Your name").fill("Second Alice");
  await expect
    .poll(async () => (await serverDoc(request, secondId)).names)
    .not.toEqual({});

  expect((await serverDoc(request, secondId)).availability).toEqual({});
  expect(await serverEventName(request, firstId)).not.toBe(second);
});

test("malformed creation POSTs are rejected and leave the calendar intact", async ({
  page,
  request,
}) => {
  const name = randomName("malformed");
  const { id, nextMonthName } = await createCalendar(page, { name });
  await expect.poll(() => serverEventName(request, id)).toBe(name);
  const before = await serverDoc(request, id);

  for (const data of [
    Buffer.alloc(0),
    Buffer.from([0, 0]),
    Buffer.from("not a yjs update"),
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]),
    Buffer.from(JSON.stringify(before.event)),
  ]) {
    const res = await request.post(`/parties/main/${id}`, { data });
    expect(res.status()).toBe(400);
  }

  expect(await serverDoc(request, id)).toEqual(before);
  await page.getByRole("button", { name: `${nextMonthName} 7` }).click();
  await expect
    .poll(async () => (await serverDoc(request, id)).availability)
    .not.toEqual({});
});
