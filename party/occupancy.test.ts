/// <reference types="@cloudflare/vitest-plugin/types" />
import { abortAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { getServerByName } from "partyserver";
import { expect, test } from "vitest";

import type { Rooms } from "./rooms";

test("prototype-named room counts survive restart, removal and reinsertion", async () => {
  const registry = () => getServerByName(env.rooms, "prototype-room-counts");
  const storedRooms = async (): Promise<Rooms> => {
    const stored = await runInDurableObject(
      await registry(),
      (_, { storage }) => storage.get<string>("rooms"),
    );
    return JSON.parse(stored!);
  };
  const stats = async () => {
    const response = await (
      await registry()
    ).fetch("https://bear.fit/parties/rooms/prototype-room-counts");
    return response.json();
  };

  for (const room of ["__proto__", "constructor", "toString"]) {
    await (await registry()).updateRoomCount({ count: 2, room });
  }
  expect(await stats()).toMatchObject({ activeConnections: 6, rooms: 3 });
  const stored = await storedRooms();
  for (const room of ["__proto__", "constructor", "toString"]) {
    expect(Object.hasOwn(stored, room)).toBe(true);
    expect(stored[room]).toBe(2);
  }

  await abortAllDurableObjects();
  expect(await stats()).toMatchObject({ activeConnections: 6, rooms: 3 });

  await (await registry()).updateRoomCount({ count: 0, room: "__proto__" });
  expect(Object.hasOwn(await storedRooms(), "__proto__")).toBe(false);
  await (await registry()).updateRoomCount({ count: 3, room: "__proto__" });
  expect(await stats()).toMatchObject({ activeConnections: 7, rooms: 3 });
  expect((await storedRooms())["__proto__"]).toBe(3);
});
