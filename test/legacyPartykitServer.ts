#! /usr/bin/env bun

/**
 * Stands in for the PartyKit deployment during e2e tests: serves the
 * `/parties/main/:id/history` body for one seeded calendar and an empty
 * history for every other room, like PartyKit does for unknown rooms.
 */

import * as Y from "yjs";

import { encodeHistoryUpdates } from "../app/encodeHistoryUpdates";
import { AvailabilityKey, IsoDate, UserId } from "../app/schemas";
import { initializeCalendarMap } from "../app/shared-data";

export const LEGACY_CALENDAR = {
  creator: UserId.assert("legacy-creator"),
  endDate: IsoDate.assert("2030-01-14"),
  id: "legacy-partykit-calendar",
  name: "Legacy PartyKit calendar",
  startDate: IsoDate.assert("2030-01-10"),
};

function legacyHistory(): Uint8Array {
  const doc = new Y.Doc();
  const updates: Uint8Array[] = [];
  doc.on("update", (update: Uint8Array) => updates.push(update));

  initializeCalendarMap(doc, LEGACY_CALENDAR);
  doc.getMap("names").set(LEGACY_CALENDAR.creator, "Legacy Larry");
  doc
    .getMap("availability")
    .set(
      AvailabilityKey(LEGACY_CALENDAR.creator, IsoDate.assert("2030-01-12")),
      true,
    );

  return encodeHistoryUpdates(
    updates.map((value, i) => ({ clock: String(i + 1), value })),
  );
}

if (import.meta.main) {
  const history = legacyHistory();
  const port = Number(process.argv[2]);

  Bun.serve({
    fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/status") return new Response("ok");

      const match = pathname.match(/^\/parties\/main\/([^/]+)\/history$/);
      if (!match) return new Response("not found", { status: 404 });

      return new Response(
        match[1] === LEGACY_CALENDAR.id ? history : new Uint8Array(),
        { headers: { "Content-Type": "application/octet-stream" } },
      );
    },
    hostname: "127.0.0.1",
    port,
  });
}
