import type { Page } from "@playwright/test";

import { spawnSync } from "node:child_process";
import path from "node:path";
import { Doc, encodeStateAsUpdate } from "yjs";

import { expect, test } from "../test";
import { CalendarEvent } from "./schemas";
import { initializeCalendarMap } from "./shared-data";

test.setTimeout(45_000);

const SIGN_SCRIPT = path.join(process.cwd(), ".ssh", "sign-message.tsx");
const OCCUPANCY_ENDPOINT = "/parties/rooms/index";

function sign(message: string): string {
  const result = spawnSync("bun", [SIGN_SCRIPT, message, "./test"], {
    cwd: process.cwd(),
    encoding: "utf-8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Signing script failed with status ${result.status}: ${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

async function openDashboard(page: Page) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".bg-neutral-100 dl")).toBeVisible();
  return page.locator("code");
}

async function connectToRoom(page: Page, room: string) {
  await page.evaluate(async (roomId) => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${location.host}/parties/main/${roomId}`,
    );
    const win = window as { __testSockets?: WebSocket[] };
    win.__testSockets ??= [];
    win.__testSockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () =>
        reject(new Error(`failed to connect to room ${roomId}`)),
      );
    });
  }, room);
}

async function authorize(page: Page, signature: string) {
  await page.getByPlaceholder("admin access key").fill(signature);
  await page.getByRole("button", { name: "Authorize" }).click();
}

test("occupancy endpoint rejects public writes", async ({ request }) => {
  const response = await request.post(OCCUPANCY_ENDPOINT, {
    data: { count: 999, room: `forged-room-${Date.now()}` },
  });
  expect(response.status()).toBe(405);

  const publicInfo = await request.get(OCCUPANCY_ENDPOINT);
  expect(await publicInfo.json()).toEqual({
    activeConnections: expect.any(Number),
    rooms: expect.any(Number),
  });
});

test("dashboard only shows per-room details after signing its challenge", async ({
  page,
}) => {
  const roomA = `room-a-${Date.now()}`;
  const roomB = `room-b-${Date.now()}`;
  const calendarId = `registered-${Date.now()}`;

  const calendar = new Doc();
  initializeCalendarMap(
    calendar,
    CalendarEvent.assert({
      id: calendarId,
      creator: "dashboard-spec",
      endDate: "2030-01-12",
      name: "Registered calendar",
      startDate: "2030-01-06",
    }),
  );
  const created = await page.request.post(`/parties/main/${calendarId}`, {
    data: Buffer.from(encodeStateAsUpdate(calendar)),
  });
  expect(created.ok()).toBe(true);

  const challenge = await openDashboard(page);
  await connectToRoom(page, roomA);
  await connectToRoom(page, roomB);

  await expect(page.locator(".bg-neutral-100 ul li")).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Calendars" })).toHaveCount(0);

  await authorize(page, sign(await challenge.innerText()));

  await expect(
    page
      .getByRole("table", { name: "Calendars" })
      .getByRole("link", { name: calendarId }),
  ).toHaveAttribute("href", `/?id=${calendarId}`);

  const roomList = page.locator(".bg-neutral-100 ul");
  await expect(
    roomList
      .getByRole("listitem")
      .filter({ hasText: `${roomA}: 1 connections` }),
  ).toBeVisible();
  await expect(
    roomList
      .getByRole("listitem")
      .filter({ hasText: `${roomB}: 1 connections` }),
  ).toBeVisible();
  await expect(page.locator(".bg-neutral-100 dl")).toHaveCount(0);
});

test("dashboard rejects replayed signatures", async ({ browser, page }) => {
  const firstChallenge = await openDashboard(page);
  const challengeText = await firstChallenge.innerText();
  const signature = sign(challengeText);

  await authorize(page, signature);
  await expect(page.locator(".bg-neutral-100 ul")).toBeAttached();
  await expect(firstChallenge).toBeHidden();

  const otherPage = await browser.newPage();
  const otherChallenge = await openDashboard(otherPage);
  const otherChallengeText = await otherChallenge.innerText();
  expect(otherChallengeText).not.toBe(challengeText);

  await authorize(otherPage, signature);
  await expect(otherChallenge).not.toHaveText(otherChallengeText);
  await expect(otherPage.locator(".bg-neutral-100 dl")).toBeVisible();
  await expect(otherPage.locator(".bg-neutral-100 ul")).not.toBeAttached();

  await otherPage.close();
});
