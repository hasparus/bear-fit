import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";

test("users without a name get a stable anonymous name instead of their id", async ({
  browser,
  page: alice,
}) => {
  const { id, nextMonthName } = await createCalendar(alice);

  const aliceName = alice.getByLabel("name");
  const anonymous = (await aliceName.getAttribute("placeholder"))!;
  expect(anonymous).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);

  await alice.reload();
  await expect(aliceName).toHaveAttribute("placeholder", anonymous);

  await alice.getByRole("button", { name: `${nextMonthName} 7` }).click();

  await using bobContext = await browser.newContext();
  await using bob = await bobContext.newPage();
  await bob.goto(`/?id=${id}`);
  await expect(bob.getByLabel("name")).not.toHaveAttribute(
    "placeholder",
    anonymous,
  );

  const aliceRow = bob.locator("dl div").filter({ hasText: /1 date$/ });
  await expect(aliceRow).toContainText(anonymous);

  await bob.getByRole("button", { name: `${nextMonthName} 7` }).hover();
  await expect(bob.locator("li", { hasText: anonymous })).toBeVisible();

  await aliceName.fill("Alice");
  await expect(aliceRow).toContainText("Alice");

  await aliceName.fill("");
  await expect(aliceRow).toContainText(anonymous);
});
