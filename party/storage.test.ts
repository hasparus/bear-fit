/// <reference types="@cloudflare/vitest-plugin/types" />
import { abortAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { getServerByName } from "partyserver";
import { expect, test, vi } from "vitest";
import * as Y from "yjs";

import type { CalendarEvent } from "../app/schemas";
import type { Env } from "./worker";

import { decodeHistoryUpdates } from "../app/decodeHistoryUpdates";
import { initializeCalendarMap, yDocToJson } from "../app/shared-data";
import { EditorPartyServer, HISTORY_LIMIT } from "./editor.partyserver";
import { OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "./rooms";

declare global {
  namespace Cloudflare {
    interface Env extends EnvBindings {}
  }
}
type EnvBindings = Env;

const event = (id: string) =>
  ({
    id,
    creator: "alice",
    endDate: "2026-11-11",
    name: "Bear picnic",
    startDate: "2026-11-06",
  }) as CalendarEvent;

function startCalendar(id: string) {
  return getServerByName(env.main, id);
}

async function fetchHistory(id: string) {
  const stub = await startCalendar(id);
  const response = await stub.fetch(
    `https://bear.fit/parties/main/${id}/history`,
  );
  return decodeHistoryUpdates(new Uint8Array(await response.arrayBuffer()));
}

function replay(updates: { value: Uint8Array }[]) {
  const doc = new Y.Doc();
  for (const { value } of updates) Y.applyUpdate(doc, value);
  return doc;
}

async function registeredCalendars() {
  const registry = await getServerByName(
    env.rooms,
    OCCUPANCY_SERVER_SINGLETON_ROOM_ID,
  );
  return runInDurableObject(registry, (_, state) =>
    state.storage.sql.exec("SELECT id, created_at FROM calendars").toArray(),
  );
}

test.for([
  { case: "log matches snapshot", snapshotOnlyEdits: 0 },
  { case: "snapshot has an edit missing from the log", snapshotOnlyEdits: 1 },
])(
  "start migrates the legacy layout into history: $case",
  async ({ snapshotOnlyEdits }) => {
    const id = `legacy-calendar-${snapshotOnlyEdits}`;

    const source = new Y.Doc();
    const logged: Uint8Array[] = [];
    const log = (update: Uint8Array) => logged.push(update);
    source.on("update", log);
    initializeCalendarMap(source, event(id));
    source.getMap("names").set("alice", "Alice");
    source.getMap("availability").set("alice|2026-11-07", true);
    source.off("update", log);
    if (snapshotOnlyEdits) {
      source.getMap("availability").set("alice|2026-11-08", true);
    }
    const snapshot = Y.encodeStateAsUpdate(source);

    const stub = env.main.get(env.main.idFromName(id));
    await runInDurableObject(stub, (_, state) => {
      const { sql } = state.storage;
      sql.exec(
        "CREATE TABLE documents (id TEXT PRIMARY KEY, state BLOB NOT NULL)",
      );
      sql.exec(
        "CREATE TABLE document_updates (doc_id TEXT NOT NULL, clock INTEGER NOT NULL, update_data BLOB NOT NULL, PRIMARY KEY (doc_id, clock))",
      );
      sql.exec("INSERT INTO documents (id, state) VALUES (?, ?)", id, snapshot);
      logged.forEach((update, index) =>
        sql.exec(
          "INSERT INTO document_updates (doc_id, clock, update_data) VALUES (?, ?, ?)",
          id,
          index + 1,
          update,
        ),
      );
    });

    const history = await fetchHistory(id);

    expect(
      await runInDurableObject(stub, (_, state) =>
        state.storage.sql
          .exec<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'",
          )
          .toArray()
          .map((row) => row.name),
      ),
    ).toEqual(["history"]);
    expect(history.map((update) => update.clock)).toEqual(
      [...Array(logged.length + snapshotOnlyEdits).keys()].map((i) =>
        String(i + 1),
      ),
    );
    for (let length = 1; length <= logged.length; length++) {
      expect(yDocToJson(replay(history.slice(0, length)))).toEqual(
        yDocToJson(replay(logged.slice(0, length).map((value) => ({ value })))),
      );
    }
    expect(yDocToJson(replay(history))).toEqual(yDocToJson(source));

    const calendar = await (
      await (
        await startCalendar(id)
      ).fetch(`https://bear.fit/parties/main/${id}`)
    ).json();
    expect(calendar).toEqual(yDocToJson(source));

    await vi.waitFor(async () =>
      expect(await registeredCalendars()).toContainEqual({
        id,
        created_at: null,
      }),
    );

    await abortAllDurableObjects();
    expect(await fetchHistory(id)).toEqual(history);
  },
);

test("POST registers the calendar with its creation time", async () => {
  const id = "registered-calendar";
  const before = Date.now();

  const stub = await startCalendar(id);
  const response = await stub.fetch(`https://bear.fit/parties/main/${id}`, {
    body: JSON.stringify(event(id)),
    method: "POST",
  });
  expect(response.status).toBe(200);

  const [registered] = (await registeredCalendars()).filter(
    (row) => row.id === id,
  );
  expect(registered.created_at as number).toBeGreaterThanOrEqual(before);
});

test("history is compacted past its limit and keeps recent edits granular", async () => {
  const id = "busy-calendar";
  const edits = HISTORY_LIMIT + 200;

  const stub = await startCalendar(id);
  await stub.fetch(`https://bear.fit/parties/main/${id}`, {
    body: JSON.stringify(event(id)),
    method: "POST",
  });
  const expected = await runInDurableObject(
    stub,
    (instance: EditorPartyServer) => {
      const names = instance.document.getMap("names");
      for (let i = 0; i < edits; i++) names.set(`user-${i}`, `User ${i}`);
      return yDocToJson(instance.document);
    },
  );

  const history = await fetchHistory(id);
  const clocks = history.map((update) => Number(update.clock));

  expect(history.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  expect(clocks).toEqual(clocks.toSorted((a, b) => a - b));
  expect(yDocToJson(replay(history))).toEqual(expected);

  const doc = new Y.Doc();
  const nameCounts = history.map(({ value }) => {
    Y.applyUpdate(doc, value);
    return doc.getMap("names").size;
  });
  const recent = HISTORY_LIMIT / 2;
  expect(nameCounts.slice(-recent)).toEqual(
    [...Array(recent).keys()].map((i) => edits - recent + 1 + i),
  );

  await abortAllDurableObjects();
  expect(await fetchHistory(id)).toEqual(history);
});
