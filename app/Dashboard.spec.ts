import type { APIRequestContext } from "@playwright/test";

import { spawnSync } from "node:child_process";
import path from "node:path";

import { expect, test } from "../test";

test.setTimeout(45_000);

const AUTH_MESSAGE = "dashboard";
const SIGN_SCRIPT = path.join(process.cwd(), ".ssh", "sign-message.tsx");
const SIGNATURE = (() => {
  const result = spawnSync("bun", [SIGN_SCRIPT, AUTH_MESSAGE, "./test"], {
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
})();
const OCCUPANCY_ENDPOINT = "/parties/rooms/index";

async function updateRoomCount(
  request: APIRequestContext,
  room: string,
  count: number,
) {
  const response = await request.post(OCCUPANCY_ENDPOINT, {
    data: { count, room },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to update room "${room}" to ${count}: ${response.status()} ${await response.text()}`,
    );
  }
}

test("dashboard only shows per-room details after successful authorization", async ({
  page,
  request,
}) => {
  const roomA = `room-a-${Date.now()}`;
  const roomB = `room-b-${Date.now()}`;

  await updateRoomCount(request, roomA, 0);
  await updateRoomCount(request, roomB, 0);
  await updateRoomCount(request, roomA, 3);
  await updateRoomCount(request, roomB, 5);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard\.html$/);

  const summary = page.locator(".bg-neutral-100 dl");
  await expect(summary).toBeVisible();
  await expect(summary.getByText("Rooms:")).toBeVisible();
  await expect(summary.getByText("Active connections:")).toBeVisible();
  await expect(page.locator(".bg-neutral-100 ul li")).toHaveCount(0);

  await page.getByPlaceholder("admin access key").fill(SIGNATURE);
  await page.getByRole("button", { name: "Authorize" }).click();

  const roomList = page.locator(".bg-neutral-100 ul");
  await expect(roomList).toBeVisible();
  await expect(
    roomList
      .getByRole("listitem")
      .filter({ hasText: `${roomA}: 3 connections` }),
  ).toBeVisible();
  await expect(
    roomList
      .getByRole("listitem")
      .filter({ hasText: `${roomB}: 5 connections` }),
  ).toBeVisible();

  await expect(summary).toHaveCount(0);

  await updateRoomCount(request, roomA, 0);
  await updateRoomCount(request, roomB, 0);
});
