import { type } from "arktype";
import {
  type Connection,
  type ConnectionContext,
  getServerByName,
} from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

import type { Env } from "./worker";

import { encodeHistoryUpdates } from "../app/encodeHistoryUpdates";
import { CalendarEvent } from "../app/schemas";
import {
  hasCalendarEvent,
  initializeCalendarMap,
  yDocToJson,
} from "../app/shared-data";
import { OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "./rooms";

/**
 * Past this many rows, the older half of the history is merged pairwise, so
 * old versions get coarser while recent edits stay individually restorable.
 */
export const HISTORY_LIMIT = 500;

interface HistoryRow extends Record<string, SqlStorageValue> {
  clock: number;
  data: ArrayBuffer;
}

/**
 * One Durable Object holds one calendar. Its Yjs document is persisted only as
 * the `history` log: every update is appended as it happens and the document
 * is rebuilt from the log on start.
 */
export class EditorPartyServer extends YServer<Env> {
  #historyLength = 0;
  #occupancyReport = Promise.resolve();
  #registered = false;

  async onStart(): Promise<void> {
    migrateStorage(this.ctx.storage);
    await super.onStart();

    this.document.on("update", (update: Uint8Array) => {
      try {
        this.appendHistory(update);
      } catch (error) {
        console.error("failed to persist update, resetting", error);
        this.ctx.abort("failed to persist update");
      }
      this.registerCalendar(Date.now());
    });

    this.registerCalendar(null);
  }

  async onLoad(): Promise<void> {
    const rows = this.ctx.storage.sql
      .exec<HistoryRow>("SELECT clock, data FROM history ORDER BY clock")
      .toArray();
    for (const row of rows) Y.applyUpdate(this.document, bytes(row));
    this.#historyLength = rows.length;
  }

  async onConnect(
    connection: Connection,
    ctx: ConnectionContext,
  ): Promise<void> {
    await super.onConnect(connection, ctx);
    void this.updateOccupancyCount();
  }

  async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    await super.onClose(connection, code, reason, wasClean);
    void this.updateOccupancyCount();
  }

  async onRequest(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST") {
      const event = CalendarEvent(await request.json().catch(() => null));
      if (event instanceof type.errors) {
        return Response.json({ error: "invalid calendar" }, { status: 400 });
      }
      if (hasCalendarEvent(this.document)) {
        return Response.json(
          { error: "calendar already created" },
          { status: 403 },
        );
      }

      initializeCalendarMap(this.document, event);
      return Response.json({ message: "created" });
    }

    if (request.method === "GET") {
      if (pathname === `/parties/main/${this.name}/history`) {
        const rows = this.ctx.storage.sql
          .exec<HistoryRow>("SELECT clock, data FROM history ORDER BY clock")
          .toArray();
        const body = encodeHistoryUpdates(
          rows.map((row) => ({ clock: String(row.clock), value: bytes(row) })),
        );
        return new Response(body, {
          headers: { "Content-Type": "application/octet-stream" },
        });
      }

      if (pathname === `/parties/main/${this.name}`) {
        return Response.json(yDocToJson(this.document));
      }
    }

    return Response.json({ message: "not found" }, { status: 404 });
  }

  private appendHistory(update: Uint8Array) {
    const { sql } = this.ctx.storage;
    sql.exec("INSERT INTO history (data) VALUES (?)", update);
    this.#historyLength += 1;

    if (this.#historyLength <= HISTORY_LIMIT) return;

    const older = sql
      .exec<HistoryRow>(
        "SELECT clock, data FROM history ORDER BY clock LIMIT ?",
        Math.floor(this.#historyLength / 2),
      )
      .toArray();
    for (let i = 0; i + 1 < older.length; i += 2) {
      const [first, second] = [older[i], older[i + 1]];
      sql.exec(
        "UPDATE history SET data = ? WHERE clock = ?",
        Y.mergeUpdates([bytes(first), bytes(second)]),
        second.clock,
      );
      sql.exec("DELETE FROM history WHERE clock = ?", first.clock);
      this.#historyLength -= 1;
    }
  }

  /**
   * Records the calendar in the occupancy server's registry once this instance
   * sees an event: loaded from storage on start (creation time unknown, so
   * `null`) or arriving in an update, whether from the POST or a sync.
   */
  private registerCalendar(createdAt: number | null) {
    if (this.#registered || !hasCalendarEvent(this.document)) return;
    this.#registered = true;
    getServerByName(this.env.rooms, OCCUPANCY_SERVER_SINGLETON_ROOM_ID)
      .then((registry) =>
        registry.registerCalendar({ id: this.name, createdAt }),
      )
      .catch((error) => {
        this.#registered = false;
        console.error("failed to register calendar", error);
      });
  }

  /**
   * Reports run one at a time and read the connection count when they run, so
   * a slow report can't land after a newer one and publish a stale count.
   */
  private updateOccupancyCount() {
    this.#occupancyReport = this.#occupancyReport.then(() =>
      this.reportOccupancyCount(),
    );
    return this.#occupancyReport;
  }

  private async reportOccupancyCount() {
    try {
      const stub = await getServerByName(
        this.env.rooms,
        OCCUPANCY_SERVER_SINGLETON_ROOM_ID,
      );
      const count = Array.from(this.getConnections()).length;
      await stub.updateRoomCount({ count, room: this.name });
    } catch (error) {
      console.error("failed to notify occupancy server", error);
    }
  }
}

/**
 * Creates the `history` table and moves data from the earlier layout into it:
 * a `documents (id, state)` snapshot and a `document_updates (doc_id, clock,
 * update_data)` log, both keyed by the room name. Log rows are replayed in
 * order, then the snapshot is applied, so any edit the log is missing lands as
 * one final row. Runs in a single transaction and drops the old tables, so a
 * failure leaves storage untouched and a rerun is a no-op.
 */
export function migrateStorage(storage: DurableObjectStorage) {
  storage.transactionSync(() => {
    const { sql } = storage;
    sql.exec(
      "CREATE TABLE IF NOT EXISTS history (clock INTEGER PRIMARY KEY, data BLOB NOT NULL)",
    );

    const legacyTables = sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('document_updates', 'documents')",
      )
      .toArray()
      .map((row) => row.name);
    if (legacyTables.length === 0) return;

    const doc = new Y.Doc();
    doc.on("update", (update: Uint8Array) => {
      sql.exec("INSERT INTO history (data) VALUES (?)", update);
    });

    if (legacyTables.includes("document_updates")) {
      const updates = sql
        .exec<{
          update_data: ArrayBuffer;
        }>("SELECT update_data FROM document_updates ORDER BY clock")
        .toArray();
      for (const row of updates) {
        Y.applyUpdate(doc, new Uint8Array(row.update_data));
      }
      sql.exec("DROP TABLE document_updates");
    }

    if (legacyTables.includes("documents")) {
      const snapshots = sql
        .exec<{ state: ArrayBuffer }>("SELECT state FROM documents")
        .toArray();
      for (const row of snapshots) {
        Y.applyUpdate(doc, new Uint8Array(row.state));
      }
      sql.exec("DROP TABLE documents");
    }
  });
}

function bytes(row: HistoryRow) {
  return new Uint8Array(row.data);
}
