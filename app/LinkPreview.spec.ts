import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";

const SLACKBOT = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)";
const CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const metaContent = (html: string, property: string) =>
  html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1];

test("crawlers get the calendar's name and dates in the meta tags", async ({
  page,
}) => {
  const name = `trip "to the" <hills> ${Math.random().toString(36).slice(2, 8)}`;
  const { id } = await createCalendar(page, { name });

  await expect
    .poll(async () => {
      const response = await page.request.get(`/?id=${id}`, {
        headers: { "User-Agent": SLACKBOT },
      });
      return metaContent(await response.text(), "og:title");
    })
    .toBe(`bear-fit · ${name.replaceAll('"', "&quot;")}`);

  const html = await (
    await page.request.get(`/?id=${id}`, {
      headers: { "User-Agent": SLACKBOT },
    })
  ).text();
  expect(html).toContain(
    `<title>bear-fit · ${name.replace("<", "&lt;").replace(">", "&gt;")}</title>`,
  );
  expect(metaContent(html, "og:description")).toMatch(
    /^pick dates between [A-Z][a-z]{2} 6 and [A-Z][a-z]{2} 12, \d{4}$/,
  );

  const imageUrl = new URL(
    metaContent(html, "og:image")!.replaceAll("&amp;", "&"),
  );
  expect(imageUrl.searchParams.get("v")).toBeTruthy();
  const image = await page.request.get(imageUrl.href);
  expect(image.headers()["content-type"]).toBe("image/png");
  const png = await image.body();
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);

  // A crawler revalidating with the static file's ETag still gets the tags.
  const etag = (await page.request.get("/")).headers()["etag"];
  const revalidated = await page.request.get(`/?id=${id}`, {
    headers: { "If-None-Match": etag, "User-Agent": SLACKBOT },
  });
  expect(revalidated.status()).toBe(200);
  expect(revalidated.headers()["etag"]).toBeUndefined();
  expect(metaContent(await revalidated.text(), "og:title")).toBe(
    `bear-fit · ${name.replaceAll('"', "&quot;")}`,
  );
});

test("people get the static index.html untouched", async ({ page }) => {
  const { id } = await createCalendar(page);

  const get = async (path: string) =>
    (
      await page.request.get(path, { headers: { "User-Agent": CHROME } })
    ).text();

  const [calendarPage, home] = await Promise.all([get(`/?id=${id}`), get("/")]);
  expect(calendarPage).toBe(home);
  expect(metaContent(calendarPage, "og:title")).toBe("bear-fit");
  expect(metaContent(calendarPage, "og:image")).toBeUndefined();
});

test("crawlers get the generic tags for an unknown calendar", async ({
  page,
}) => {
  const response = await page.request.get("/?id=does-not-exist", {
    headers: { "User-Agent": SLACKBOT },
  });
  expect(metaContent(await response.text(), "og:title")).toBe("bear-fit");

  const image = await page.request.get("/og.png?id=does-not-exist");
  expect(image.status()).toBe(404);
});
