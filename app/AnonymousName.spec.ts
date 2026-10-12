import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";

test("users without a name get a stable anonymous name instead of their id", async ({
  browser,
  page: alice,
}) => {
  const { id, nextMonthName } = await createCalendar(alice);

  const nameInput = alice.getByLabel("name");
  const anonymous = await nameInput.getAttribute("placeholder");
  expect(anonymous).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);

  await alice.reload();
  await expect(nameInput).toHaveAttribute("placeholder", anonymous!);

  await alice.getByRole("button", { name: `${nextMonthName} 7` }).click();

  await using bobContext = await browser.newContext();
  await using bob = await bobContext.newPage();
  await bob.goto(`/?id=${id}`);

  await expect(
    bob.locator("dl div").filter({ hasText: anonymous! }),
  ).toContainText("1 date");
});
