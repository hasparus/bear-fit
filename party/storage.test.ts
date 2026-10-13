/// <reference types="@cloudflare/vitest-plugin/types" />
import { abortAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { getServerByName } from "partyserver";
import { expect, test, vi } from "vitest";
import * as Y from "yjs";

import type { EditorPartyServer } from "./editor.partyserver";
import type { Env } from "./worker";

import { decodeHistoryUpdates } from "../app/decodeHistoryUpdates";
import { CalendarEvent } from "../app/schemas";
import { initializeCalendarMap, yDocToJson } from "../app/shared-data";
import { HISTORY_LIMIT, MAX_UPDATE_BYTES } from "./history";
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

function creationUpdate(id: string) {
  const doc = new Y.Doc();
  initializeCalendarMap(doc, event(id));
  return Y.encodeStateAsUpdate(doc);
}

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

test("start drops leftover tables and registers the stored calendar", async () => {
  const id = "stored-calendar";
  const update = creationUpdate(id);
  const stub = env.main.get(env.main.idFromName(id));
  await runInDurableObject(stub, (_, { storage: { sql } }) => {
    sql.exec("CREATE TABLE documents (id TEXT PRIMARY KEY, state BLOB)");
    sql.exec("CREATE TABLE document_updates (update_data BLOB)");
    sql.exec("CREATE TABLE history (clock INTEGER PRIMARY KEY, data BLOB)");
    sql.exec("INSERT INTO history (data) VALUES (?)", update);
  });

  const calendar = await (
    await (await startCalendar(id)).fetch(`https://bear.fit/parties/main/${id}`)
  ).json();

  expect(calendar).toEqual(yDocToJson(replay([{ value: update }])));
  expect(await tableNames(id)).toEqual(["history"]);
  await vi.waitFor(async () =>
    expect(await registeredCalendars()).toContainEqual({
      id,
      created_at: null,
    }),
  );
});

async function connect(id: string) {
  const stub = await startCalendar(id);
  const response = await stub.fetch(`https://bear.fit/parties/main/${id}`, {
    headers: { Upgrade: "websocket" },
  });
  const socket = response.webSocket!;
  socket.accept();
  const closeCode = new Promise<number>((resolve) =>
    socket.addEventListener("close", (event) => resolve(event.code)),
  );
  return { closeCode, socket, stub };
}

test("oversized updates close the socket instead of reaching storage", async () => {
  const id = "oversized-calendar";
  const { closeCode, socket } = await connect(id);

  const doc = new Y.Doc();
  doc.getMap("names").set("alice", "a".repeat(MAX_UPDATE_BYTES));
  socket.send(syncUpdateMessage(Y.encodeStateAsUpdate(doc)));

  expect(await closeCode).toBe(1009);
  expect(await fetchHistory(id)).toEqual([]);
});

test("pending structs past the limit are dropped instead of stored once unblocked", async () => {
  const id = "pending-flood-calendar";
  const { closeCode, socket, stub } = await connect(id);

  const source = new Y.Doc();
  const list = source.getArray<number>("list");
  const [missing, ...orphans] = recordUpdates(source, () => {
    source.getMap("names").set("first", "x");
    // Many small structs encode far smaller in V2, which Yjs keeps pending in.
    for (let batch = 0; batch < 20; batch++) {
      source.transact(() => {
        for (let i = 0; i < 4000; i++) list.insert(0, [i]);
      });
    }
  });
  for (const orphan of orphans) socket.send(syncUpdateMessage(orphan));

  expect(await closeCode).toBe(1009);
  const second = await connect(id);
  second.socket.send(syncUpdateMessage(missing));
  await vi.waitFor(async () => expect(await fetchHistory(id)).toHaveLength(1));
  expect(
    await runInDurableObject(stub, (instance: EditorPartyServer) => ({
      list: instance.document.getArray("list").length,
      names: instance.document.getMap("names").toJSON(),
    })),
  ).toEqual({ list: 0, names: { first: "x" } });
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
    body: creationUpdate(id),
    method: "POST",
  });
  expect(response.status).toBe(200);

  await vi.waitFor(async () =>
    expect((await registeredAt(id)) ?? 0).toBeGreaterThanOrEqual(before),
  );
});

test("a POSTed calendar is stored once and survives a restart", async () => {
  const id = "posted-calendar";
  const created = new Y.Doc();
  initializeCalendarMap(created, event(id));
  const update = Y.encodeStateAsUpdate(created);

  for (let i = 0; i < 2; i++) {
    const response = await (
      await startCalendar(id)
    ).fetch(`https://bear.fit/parties/main/${id}`, {
      body: update,
      method: "POST",
    });
    expect(response.status).toBe(200);
  }
  expect(await fetchHistory(id)).toHaveLength(1);

  await abortAllDurableObjects();
  const calendar = await (
    await (await startCalendar(id)).fetch(`https://bear.fit/parties/main/${id}`)
  ).json();
  expect(calendar).toEqual(yDocToJson(created));
});

function afterMissingUpdate(edit: (names: Y.Map<string>) => void) {
  const doc = new Y.Doc();
  const names = doc.getMap<string>("names");
  names.set("alice", "Alice");
  const [update] = recordUpdates(doc, () => edit(names));
  return update;
}

test.for([
  {
    case: "depend on missing structs",
    body: (id: string) =>
      Y.mergeUpdates([
        creationUpdate(id),
        afterMissingUpdate((names) => names.set("bob", "Bob")),
      ]),
  },
  {
    case: "depend on missing deletes",
    body: (id: string) =>
      Y.mergeUpdates([
        creationUpdate(id),
        afterMissingUpdate((names) => names.delete("alice")),
      ]),
  },
  {
    body: () => creationUpdate("another-calendar"),
    case: "create another calendar",
  },
])("creation POSTs that $case are rejected", async ({ body, case: name }) => {
  const id = `rejected-post-${name.replaceAll(" ", "-")}`;
  const stub = await startCalendar(id);
  const response = await stub.fetch(`https://bear.fit/parties/main/${id}`, {
    body: body(id),
    method: "POST",
  });
  expect(response.status).toBe(400);
  expect(await fetchHistory(id)).toEqual([]);
  expect(
    await runInDurableObject(
      stub,
      ({ document: { store } }: EditorPartyServer) =>
        store.pendingStructs ?? store.pendingDs,
    ),
  ).toBeNull();
});

test("oversized creation POSTs are refused before reaching storage", async () => {
  const id = "oversized-post-calendar";
  const doc = new Y.Doc();
  initializeCalendarMap(doc, event(id));
  doc.getMap("names").set("alice", "a".repeat(MAX_UPDATE_BYTES));

  const response = await (
    await startCalendar(id)
  ).fetch(`https://bear.fit/parties/main/${id}`, {
    body: Y.encodeStateAsUpdate(doc),
    method: "POST",
  });
  expect(response.status).toBe(413);
  expect(await fetchHistory(id)).toEqual([]);
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
    body: creationUpdate(id),
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
