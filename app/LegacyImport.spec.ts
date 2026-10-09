import { expect, test } from "../test";
import { LEGACY_CALENDAR } from "../test/legacyPartykitServer";

test("imports a calendar from the legacy PartyKit deployment on first visit", async ({
  page,
}) => {
  await page.goto(`/?id=${LEGACY_CALENDAR.id}`);

  await expect(
    page.getByRole("heading", { name: LEGACY_CALENDAR.name }),
  ).toBeVisible();
  await expect(
    page.locator("dl div").filter({ hasText: /Legacy Larry/ }),
  ).toContainText("1 date");

  const history = await page.request.get(
    `/parties/main/${LEGACY_CALENDAR.id}/history`,
  );
  expect((await history.body()).byteLength).toBeGreaterThan(0);
});
