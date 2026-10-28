import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";

test("cursors join only the open calendar's room", async ({ page }) => {
  // the room is decided by the script tag, so the script itself isn't needed
  await page.route("https://cursor-party.hasparus.workers.dev/**", (route) =>
    route.abort(),
  );
  const cursorScripts = page.locator('script[src*="cursor-party"]');

  await page.goto("/");
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });
  await expect(cursorScripts).toHaveCount(0);

  const { id } = await createCalendar(page);
  await expect(cursorScripts).toHaveAttribute("data-room", id);

  // leaving keeps the script loaded but out of every room
  await page.goBack();
  await page.getByText("Create a Calendar").waitFor({ state: "visible" });
  await expect(cursorScripts).toHaveAttribute("data-room", "");

  await page.goForward();
  await expect(cursorScripts).toHaveAttribute("data-room", id);
  await expect(cursorScripts).toHaveCount(1);
});
