import type { Page } from "@playwright/test";

import * as Y from "yjs";

import { expect, test } from "../test";
import { createCalendar } from "../test/utils/createCalendar";
import { retryDropped, serverDoc } from "../test/utils/server";
import { decodeHistoryUpdates } from "./decodeHistoryUpdates";

async function sendUpdate(page: Page, id: string, update: Uint8Array) {
  const length = [];
  for (let n = update.length; ; n >>>= 7) {
    length.push((n & 127) | (n > 127 ? 128 : 0));
    if (n <= 127) break;
  }
  const frame = [0, 2, ...length, ...update];
  await page.evaluate(
    ({ id, frame }) =>
      new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(
          `ws://${location.host}/parties/main/${id}`,
        );
        socket.addEventListener("error", () =>
          reject(new Error("Test socket failed")),
        );
        socket.addEventListener("open", () => {
          socket.send(new Uint8Array(frame));
          socket.close();
          resolve();
        });
      }),
    { id, frame },
  );
}

test("invalid live and persisted dates stay bounded and recover, including history", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { id } = await createCalendar(page, { name: `bounded ${Date.now()}` });
  await expect
    .poll(async () => (await serverDoc(request, id)).event)
    .toHaveProperty("endDate");

  const history = await retryDropped(() =>
    request.get(`/parties/main/${id}/history`),
  );
  expect(history.ok()).toBe(true);
  const doc = new Y.Doc();
  for (const { value } of decodeHistoryUpdates(await history.body())) {
    Y.applyUpdate(doc, value);
  }
  const event = doc.getMap("event");
  const original = {
    endDate: event.get("endDate"),
    startDate: event.get("startDate"),
  };
  const updateDates = async (patch: Record<string, unknown>) => {
    const before = Y.encodeStateVector(doc);
    doc.transact(() => {
      for (const key of ["startDate", "endDate", "rolling"]) event.delete(key);
      for (const [key, value] of Object.entries(patch)) event.set(key, value);
    });
    await sendUpdate(page, id, Y.encodeStateAsUpdate(doc, before));
    await expect
      .poll(async () => {
        const { endDate, rolling, startDate } = (await serverDoc(request, id))
          .event;
        return Object.fromEntries(
          Object.entries({ endDate, rolling, startDate }).filter(
            ([, value]) => value !== undefined,
          ),
        );
      })
      .toEqual(patch);
  };
  const alert = page.getByRole("alert");
  const gridButtons = page.getByRole("grid").getByRole("button");

  for (const patch of [
    { endDate: "2024-01-02", startDate: "not-a-date" },
    { endDate: "2024-01-01", startDate: "2024-01-02" },
    { endDate: "2025-01-01", startDate: "2024-01-01" },
    { rolling: 0 },
    { rolling: 1e300 },
    { rolling: 366 },
  ]) {
    await updateDates(patch);
    await expect(alert).toContainText("Invalid calendar dates");
    await expect(gridButtons).toHaveCount(0);
    await expect(
      page
        .getByRole("contentinfo")
        .filter({ hasText: "Your recent calendars" }),
    ).toContainText("invalid calendar dates");
  }

  await page.reload();
  await expect(alert).toContainText("Invalid calendar dates");
  await expect(gridButtons).toHaveCount(0);

  await page.getByText("Nerd Mode", { exact: true }).click();
  await page.getByRole("button", { name: "Open version history" }).click();
  const historyDialog = page.getByRole("dialog", { name: "Version History" });
  await expect(historyDialog.getByRole("alert")).toContainText(
    "Invalid calendar dates",
  );
  await expect(historyDialog.getByRole("grid").getByRole("button")).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(historyDialog).not.toBeVisible();

  await updateDates({ startDate: original.startDate });
  await expect(alert).toHaveCount(0);
  await expect(gridButtons).toHaveCount(0);

  await updateDates({ endDate: "2025-01-01", startDate: "2024-01-01" });
  await expect(alert).toContainText("Invalid calendar dates");
  await page.getByText("Dates", { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit dates" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit Calendar" });
  await expect(editDialog.getByRole("alert")).toContainText(
    "Invalid calendar dates",
  );
  await expect(
    editDialog.getByRole("button", { name: "Save Changes" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(editDialog).not.toBeVisible();

  await updateDates(original);
  await expect(alert).toHaveCount(0);
  await expect(gridButtons).toHaveCount(7);
  await page.reload();
  await expect(gridButtons).toHaveCount(7);
  expect(errors).toEqual([]);
  doc.destroy();
});

for (const source of ["live", "persisted"]) {
  test(`a creator can repair a ${source} zero-day rolling calendar with fixed dates`, async ({
    page,
    request,
  }) => {
    const { id, nextMonthName } = await createCalendar(page, {
      name: `zero rolling ${source} ${Date.now()}`,
    });
    await expect
      .poll(async () => (await serverDoc(request, id)).event)
      .toHaveProperty("endDate");
    await page.reload();

    const history = await retryDropped(() =>
      request.get(`/parties/main/${id}/history`),
    );
    expect(history.ok()).toBe(true);
    const doc = new Y.Doc();
    for (const { value } of decodeHistoryUpdates(await history.body())) {
      Y.applyUpdate(doc, value);
    }
    const event = doc.getMap("event");
    const startDate = String(event.get("startDate"));
    const endDate = String(event.get("endDate"));
    const before = Y.encodeStateVector(doc);
    doc.transact(() => {
      event.delete("startDate");
      event.delete("endDate");
      event.set("rolling", 0);
    });
    await sendUpdate(page, id, Y.encodeStateAsUpdate(doc, before));
    doc.destroy();

    await expect
      .poll(async () => (await serverDoc(request, id)).event)
      .toHaveProperty("rolling", 0);
    const remembered = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("🐻👤state")!).events[0],
      );
    await expect.poll(remembered).toMatchObject({ id, rolling: 0 });
    if (source === "persisted") await page.reload();

    await expect(page.getByRole("alert")).toContainText(
      "Invalid calendar dates",
    );
    await expect(page.getByRole("grid").getByRole("button")).toHaveCount(0);
    await page.getByText("Dates", { exact: true }).click({ button: "right" });
    await page
      .getByRole("menuitem", { exact: true, name: "Edit dates" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Edit Calendar" });
    await expect(dialog).toBeVisible();
    const save = dialog.getByRole("button", { name: "Save Changes" });
    await expect(save).toBeDisabled();
    await expect(dialog.getByLabel("Rolling window")).not.toBeChecked();
    await dialog.getByRole("button", { name: "next month" }).click();
    await dialog.getByRole("button", { name: `${nextMonthName} 6th` }).click();
    await dialog.getByRole("button", { name: `${nextMonthName} 12th` }).click();
    await save.click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("grid").getByRole("button")).toHaveCount(7);
    await expect
      .poll(async () => {
        const { endDate, rolling, startDate } = (await serverDoc(request, id))
          .event;
        return { endDate, rolling, startDate };
      })
      .toEqual({ endDate, rolling: undefined, startDate });
    await expect.poll(remembered).toMatchObject({ id, endDate, startDate });
    await expect.poll(remembered).not.toHaveProperty("rolling");

    await page.reload();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("grid").getByRole("button")).toHaveCount(7);
  });
}

test("the form rejects an oversized range and accepts a new bounded selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Name your event").fill(`bounded form ${Date.now()}`);
  await page.getByRole("button", { name: "next month" }).click();
  const month = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    1,
  ).toLocaleDateString("en-US", { month: "long" });
  await page.getByRole("button", { name: `${month} 6th` }).click();
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: "next month" }).click();
  }
  await page.getByRole("button", { name: `${month} 7th` }).click();
  const submit = page.getByRole("button", {
    exact: true,
    name: "Create Calendar",
  });
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: `${month} 6th` }).click();
  await page.getByRole("button", { name: `${month} 12th` }).click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("grid").getByRole("button")).toHaveCount(7);
});
