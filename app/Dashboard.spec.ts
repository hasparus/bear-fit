import type { Page } from "@playwright/test";

import { spawnSync } from "node:child_process";
import path from "node:path";

import { expect, test } from "../test";

test.setTimeout(45_000);

const SIGN_SCRIPT = path.join(process.cwd(), ".ssh", "sign-message.tsx");
const OCCUPANCY_ENDPOINT = "/parties/rooms/index";

/**
 * Signs the dashboard auth message with the committed TEST key and returns
 * the `<timestamp>.<signatureB64>` token the dashboard input expects.
 */
function signAuthToken(timestamp?: number): string {
  const args = [SIGN_SCRIPT, "./test"];
  if (timestamp !== undefined) {
    args.push(String(timestamp));
  }
  const result = spawnSync("bun", args, {
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

/**
 * Opens a real WebSocket connection to an event room so the editor server
 * reports occupancy to the occupancy server through the internal channel.
 * The socket stays open for the lifetime of the page.
 */
async function connectToRoom(page: Page, room: string) {
  await page.evaluate(async (roomId) => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${location.host}/parties/main/${roomId}`,
    );
    interface WindowWithSockets {
      __testSockets?: WebSocket[];
    }
    const win = window as WindowWithSockets;
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

test("occupancy update endpoint rejects public POSTs", async ({ request }) => {
  const response = await request.post(OCCUPANCY_ENDPOINT, {
    data: { count: 999, room: `forged-room-${Date.now()}` },
  });

  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "forbidden" });

  const publicInfo = await request.get(OCCUPANCY_ENDPOINT);
  expect(publicInfo.ok()).toBeTruthy();
  expect(await publicInfo.json()).toEqual({
    activeConnections: expect.any(Number),
    rooms: expect.any(Number),
  });
});

test("dashboard only shows per-room details after successful authorization", async ({
  page,
}) => {
  const roomA = `room-a-${Date.now()}`;
  const roomB = `room-b-${Date.now()}`;

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  await connectToRoom(page, roomA);
  await connectToRoom(page, roomB);

  const summary = page.locator(".bg-neutral-100 dl");
  await expect(summary).toBeVisible();
  await expect(summary.getByText("Rooms:")).toBeVisible();
  await expect(summary.getByText("Active connections:")).toBeVisible();
  await expect(page.locator(".bg-neutral-100 ul li")).toHaveCount(0);

  await page.getByPlaceholder("admin access key").fill(signAuthToken());
  await page.getByRole("button", { name: "Authorize" }).click();

  const roomList = page.locator(".bg-neutral-100 ul");
  await expect(roomList).toBeVisible();
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

  await expect(summary).toHaveCount(0);
});

test("dashboard rejects stale auth tokens", async ({ page }) => {
  const room = `room-stale-${Date.now()}`;
  const staleToken = signAuthToken(Date.now() - 6 * 60_000);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  await connectToRoom(page, room);

  const summary = page.locator(".bg-neutral-100 dl");
  await expect(summary).toBeVisible();

  await page.getByPlaceholder("admin access key").fill(staleToken);
  await page.getByRole("button", { name: "Authorize" }).click();

  await page.waitForTimeout(2_000);

  await expect(page.locator(".bg-neutral-100 ul")).toHaveCount(0);
  await expect(summary).toBeVisible();
});
