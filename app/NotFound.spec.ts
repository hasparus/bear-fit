import { expect, test } from "../test";

test("shows event not found for a nonexistent room id", async ({ page }) => {
  await page.goto("/?id=definitely-not-a-real-room-xyz");

  await expect(
    page.getByRole("heading", { name: "Event not found" }),
  ).toBeVisible();

  await expect(page.getByText("Loading...")).not.toBeVisible();
});
