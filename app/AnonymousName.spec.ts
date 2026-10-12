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
  const bobName = bob.getByLabel("name");
  await expect(bobName).toHaveAttribute(
    "placeholder",
    /^[A-Z][a-z]+ [A-Z][a-z]+$/,
  );
  await expect(bobName).not.toHaveAttribute("placeholder", anonymous);

  const aliceTerm = bob.getByRole("term").filter({ hasText: "(creator)" });
  await expect(aliceTerm).toHaveText(`${anonymous} (creator)`);

  await bob.getByRole("button", { name: `${nextMonthName} 7` }).hover();
  await expect(bob.getByRole("tooltip").getByText(anonymous)).toBeVisible();

  await aliceName.fill("Alice");
  await expect(aliceTerm).toHaveText("Alice (creator)");

  await aliceName.fill("");
  await expect(aliceTerm).toHaveText(`${anonymous} (creator)`);
});
