import {
  commands,
  server as ctx,
  page,
  userEvent,
} from "@vitest/browser/context";
import * as v from "valibot";
import { afterAll, beforeAll, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { TestStyles } from "../test/TestStyles";
import { App } from "./App";
import { CalendarEvent } from "./schemas";
import { YDocJsonSchema } from "./shared-data";

let server: Awaited<ReturnType<typeof commands.startServer>>;
beforeAll(async () => {
  server = await commands.startServer();
});
afterAll(async () => {
  await commands.stopServer(server.pid);
});

it("creates a new event, fills dates, opens a new browser and fills more dates", async () => {
  render(
    <div className="pt-8">
      <App serverUrl={server.href} />
      <textarea className="opacity-0 size-0" id="debug-textarea" />
    </div>,
    { wrapper: TestStyles },
  );

  await userEvent.keyboard("{Tab}test event");

  await page.getByRole("button", { name: "next month" }).click();

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleDateString("en-US", {
    month: "long",
  });

  await expect.element(page.getByText(nextMonthName)).toBeVisible();

  const START_DAY = 6;
  const END_DAY = 12;
  const CREATOR_NAME = "Piotr";

  await page
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}th` })
    .click();
  await page
    .getByRole("button", { name: `${nextMonthName} ${END_DAY}th` })
    .click();

  await page.getByText("Create Event").click();

  // verify we're redirected to the event page
  await expect.element(page.getByText("test event")).toBeVisible();
  await expect.element(page.getByText("Event dates")).toBeVisible();

  await userEvent.keyboard("{Tab}" + CREATOR_NAME);

  // select 6th, 8th, 10th and 11th
  // (yeah, React Day Picker (above) is using custom date formatting for aria labels, so we have some inconsistencies here)
  await page
    .getByRole("button", { name: `${nextMonthName} ${START_DAY}` })
    .click();
  await page.getByRole("button", { name: `${nextMonthName} 8` }).click();
  await page.getByRole("button", { name: `${nextMonthName} 10` }).click();
  await page.getByRole("button", { name: `${nextMonthName} 11` }).click();

  // TODO:
  // Vitest Browser mode doesn't allow use to do
  //   test.use({
  //     permissions: ['clipboard-write']
  // })
  // to enable clipboard permissions in Playwright.
  // So this is temporarily disabled in headless mode.
  if (!ctx.config.browser.headless) {
    await page.getByRole("button", { name: "Copy to clipboard" }).click();
    await expect.element(page.getByText("Copied to clipboard")).toBeVisible();
  }

  await page.getByRole("button", { name: "Export to JSON" }).click();

  const json = await commands.readDownloadedJsonExport();

  const exported = v.parse(YDocJsonSchema, JSON.parse(json));

  const event = v.parse(CalendarEvent, exported.event);

  expect(event.startDate).toBe(
    `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${START_DAY.toString().padStart(2, "0")}`,
  );
  expect(event.endDate).toBe(
    `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${END_DAY}`,
  );
  expect(event.name).toBe("test event");

  const creatorId = event.creator;

  const names = (exported as { names: Record<string, string> }).names;
  const creatorName = names[creatorId];
  expect(creatorName).toBe(CREATOR_NAME);
});
