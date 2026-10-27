import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";

test("cursors join only the open calendar's room", async ({ page }) => {
  // the room is decided by the script tag, so the script itself isn't needed
  await page.route("https://cursor-party.hasparus.workers.dev/**", (route) =>
    route.abort(),
  );
  const cursorScripts = page.locator('script[src*="cursor-party"]');

  const { id } = await createCalendar(page);
  await expect(cursorScripts).toHaveCount(1);
  await expect(cursorScripts).toHaveAttribute("data-room", id);

  await page.goBack();
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });
  await expect(cursorScripts).toHaveCount(0);
});
