/// <reference types="@cloudflare/vitest-plugin/types" />
import { abortAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { getServerByName } from "partyserver";
import { expect, test, vi } from "vitest";
import * as Y from "yjs";

import type { Env } from "./worker";

import { decodeHistoryUpdates } from "../app/decodeHistoryUpdates";
import { CalendarEvent } from "../app/schemas";
import { initializeCalendarMap, yDocToJson } from "../app/shared-data";
import {
  EditorPartyServer,
  HISTORY_LIMIT,
  MAX_UPDATE_BYTES,
} from "./editor.partyserver";
import { OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "./rooms";

declare global {
  namespace Cloudflare {
    interface Env extends EnvBindings {}
  }
}
type EnvBindings = Env;

const event = (id: string) =>
  CalendarEvent.assert({
    id,
    creator: "alice",
    endDate: "2026-11-11",
    name: "Bear picnic",
    startDate: "2026-11-06",
  });

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
    state.storage.sql
      .exec<{
        id: string;
        created_at: number | null;
      }>("SELECT id, created_at FROM calendars")
      .toArray(),
  );
}

function seedLegacy(
  id: string,
  { log, snapshot }: { log: Uint8Array[]; snapshot?: Uint8Array },
) {
  const stub = env.main.get(env.main.idFromName(id));
  return runInDurableObject(stub, (_, state) => {
    const { sql } = state.storage;
    sql.exec(
      "CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, state BLOB NOT NULL)",
    );
    sql.exec(
      "CREATE TABLE IF NOT EXISTS document_updates (doc_id TEXT NOT NULL, clock INTEGER NOT NULL, update_data BLOB NOT NULL, PRIMARY KEY (doc_id, clock))",
    );
    if (snapshot) {
      sql.exec(
        "INSERT OR REPLACE INTO documents (id, state) VALUES (?, ?)",
        id,
        snapshot,
      );
    }
    const [{ clock }] = sql
      .exec<{
        clock: number;
      }>("SELECT COALESCE(MAX(clock), 0) AS clock FROM document_updates")
      .toArray();
    log.forEach((update, index) =>
      sql.exec(
        "INSERT INTO document_updates (doc_id, clock, update_data) VALUES (?, ?, ?)",
        id,
        clock + index + 1,
        update,
      ),
    );
  });
}

function tableNames(id: string) {
  const stub = env.main.get(env.main.idFromName(id));
  return runInDurableObject(stub, (_, state) =>
    state.storage.sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'",
      )
      .toArray()
      .map((row) => row.name)
      .sort(),
  );
}

function recordUpdates(doc: Y.Doc, edit: () => void) {
  const updates: Uint8Array[] = [];
  const record = (update: Uint8Array) => updates.push(update);
  doc.on("update", record);
  edit();
  doc.off("update", record);
  return updates;
}

test.for([
  { case: "log matches snapshot", snapshotOnlyEdits: 0 },
  { case: "snapshot has an edit missing from the log", snapshotOnlyEdits: 1 },
])(
  "start migrates the legacy layout into history: $case",
  async ({ snapshotOnlyEdits }) => {
    const id = `legacy-calendar-${snapshotOnlyEdits}`;

    const source = new Y.Doc();
    const logged = recordUpdates(source, () => {
      initializeCalendarMap(source, event(id));
      source.getMap("names").set("alice", "Alice");
      source.getMap("availability").set("alice|2026-11-07", true);
    });
    if (snapshotOnlyEdits) {
      source.getMap("availability").set("alice|2026-11-08", true);
    }
    await seedLegacy(id, {
      log: logged,
      snapshot: Y.encodeStateAsUpdate(source),
    });

    const history = await fetchHistory(id);

    expect(await tableNames(id)).toEqual([
      "document_updates",
      "documents",
      "history",
    ]);
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

test("start picks up legacy rows written after migration, once", async () => {
  const id = "reverted-calendar";
  const source = new Y.Doc();
  const logged = recordUpdates(source, () =>
    initializeCalendarMap(source, event(id)),
  );
  await seedLegacy(id, {
    log: logged,
    snapshot: Y.encodeStateAsUpdate(source),
  });
  const migrated = await fetchHistory(id);

  const writtenByOlderDeployment = recordUpdates(source, () =>
    source.getMap("names").set("bob", "Bob"),
  );
  await seedLegacy(id, {
    log: writtenByOlderDeployment,
    snapshot: Y.encodeStateAsUpdate(source),
  });
  await abortAllDurableObjects();

  const history = await fetchHistory(id);
  expect(history.slice(0, migrated.length)).toEqual(migrated);
  expect(history).toHaveLength(migrated.length + 1);
  expect(yDocToJson(replay(history))).toEqual(yDocToJson(source));

  await abortAllDurableObjects();
  expect(await fetchHistory(id)).toEqual(history);
});

test("undecodable legacy rows are skipped and the snapshot fills the gap", async () => {
  const id = "corrupt-calendar";
  const source = new Y.Doc();
  const [first, ...rest] = recordUpdates(source, () => {
    initializeCalendarMap(source, event(id));
    source.getMap("names").set("alice", "Alice");
  });
  await seedLegacy(id, {
    log: [first, new Uint8Array([255, 255, 255, 255]), ...rest],
    snapshot: Y.encodeStateAsUpdate(source),
  });

  const history = await fetchHistory(id);
  expect(yDocToJson(replay(history))).toEqual(yDocToJson(source));
});

test("legacy updates missing their dependencies stay behind when the snapshot decodes", async () => {
  const id = "pending-calendar";
  const source = new Y.Doc();
  const [created] = recordUpdates(source, () =>
    initializeCalendarMap(source, event(id)),
  );
  const [, orphan] = recordUpdates(source, () => {
    source.getMap("names").set("alice", "Alice");
    source.getMap("names").set("bob", "Bob");
  });
  const legacy = new Y.Doc();
  Y.applyUpdate(legacy, created);
  Y.applyUpdate(legacy, orphan);
  expect(legacy.store.pendingStructs).not.toBeNull();
  await seedLegacy(id, {
    log: [created],
    snapshot: Y.encodeStateAsUpdate(legacy),
  });

  const history = await fetchHistory(id);
  expect(yDocToJson(replay(history))).toEqual(yDocToJson(legacy));
});

const garbage = new Uint8Array([255, 255, 255, 255]);

async function expectStartToFail(id: string, message: string) {
  const stub = env.main.get(env.main.idFromName(id));
  await expect(
    stub.fetch(`https://bear.fit/parties/main/${id}`, {
      headers: { "x-partykit-room": id },
    }),
  ).rejects.toThrow(message);
  expect(await tableNames(id)).toEqual(["document_updates", "documents"]);
}

test("start fails without touching storage when no legacy row is usable", async () => {
  const id = "unreadable-calendar";
  await seedLegacy(id, { log: [garbage] });

  await expectStartToFail(id, "no usable legacy log or snapshot");
});

test("start fails when the log has a gap the snapshot can't fill", async () => {
  const id = "gapped-calendar";
  const source = new Y.Doc();
  const [, ...rest] = recordUpdates(source, () =>
    initializeCalendarMap(source, event(id)),
  );
  await seedLegacy(id, { log: [garbage, ...rest], snapshot: garbage });

  await expectStartToFail(id, "legacy data has gaps the snapshot can't fill");
});

test("oversized updates close the socket instead of reaching storage", async () => {
  const id = "oversized-calendar";
  const stub = await startCalendar(id);
  const response = await stub.fetch(`https://bear.fit/parties/main/${id}`, {
    headers: { Upgrade: "websocket" },
  });
  const socket = response.webSocket!;
  socket.accept();
  const closed = new Promise<number>((resolve) =>
    socket.addEventListener("close", (event) => resolve(event.code)),
  );

  const doc = new Y.Doc();
  doc.getMap("names").set("alice", "a".repeat(MAX_UPDATE_BYTES));
  socket.send(syncUpdateMessage(Y.encodeStateAsUpdate(doc)));

  expect(await closed).toBe(1009);
  expect(await fetchHistory(id)).toEqual([]);
});

/** A y-protocols sync message (`messageSync`, `messageYjsUpdate`). */
function syncUpdateMessage(update: Uint8Array) {
  const length: number[] = [];
  for (let n = update.length; ; n >>>= 7) {
    if (n < 0x80) {
      length.push(n);
      break;
    }
    length.push((n & 0x7f) | 0x80);
  }
  return new Uint8Array([0, 2, ...length, ...update]);
}

async function registeredAt(id: string) {
  const rows = await registeredCalendars();
  return rows.find((row) => row.id === id)?.created_at;
}

test("POST registers the calendar with its creation time", async () => {
  const id = "registered-calendar";
  const before = Date.now();

  const stub = await startCalendar(id);
  const response = await stub.fetch(`https://bear.fit/parties/main/${id}`, {
    body: JSON.stringify(event(id)),
    method: "POST",
  });
  expect(response.status).toBe(200);

  await vi.waitFor(async () =>
    expect((await registeredAt(id)) ?? 0).toBeGreaterThanOrEqual(before),
  );
});

test("a calendar created through sync is registered", async () => {
  const id = "synced-calendar";
  const before = Date.now();
  const stub = await startCalendar(id);

  await runInDurableObject(stub, (instance: EditorPartyServer) =>
    initializeCalendarMap(instance.document, event(id)),
  );

  await vi.waitFor(async () =>
    expect((await registeredAt(id)) ?? 0).toBeGreaterThanOrEqual(before),
  );
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
