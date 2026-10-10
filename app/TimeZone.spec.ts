import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";

test.use({ timezoneId: "America/Los_Angeles" });

test("labels grid days with their calendar date west of UTC", async ({
  page,
}) => {
  await createCalendar(page, { endDay: 12, startDay: 6 });

  const firstDay = page.getByRole("grid").getByRole("button").first();
  await expect(firstDay).toHaveText("6");
  await expect(firstDay).toHaveAccessibleName(/ 6, \d{4}$/);
});
