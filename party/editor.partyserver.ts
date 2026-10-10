import { type } from "arktype";
import {
  type Connection,
  type ConnectionContext,
  getServerByName,
  type WSMessage,
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
import { appendHistory, createHistoryTable, readHistory } from "./history";
import { migrateLegacyStorage } from "./legacyStorage";
import { OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "./rooms";

/**
 * Past this many rows, the older half of the history is merged pairwise, so
 * old versions get coarser while recent edits stay individually restorable.
 */
export const HISTORY_LIMIT = 500;

/** Durable Object SQLite rows top out at 2 MB; stay well under it. */
export const MAX_UPDATE_BYTES = 1024 * 1024;

/**
 * One Durable Object holds one calendar. Its Yjs document is persisted only as
 * the `history` log: every update is appended as it happens and the document
 * is rebuilt from the log on start.
 */
export class EditorPartyServer extends YServer<Env> {
  #historyLength = 0;
  #occupancyReport = Promise.resolve();
  #registered = false;
  /** `undefined` until an event is seen, `null` if it was already in storage. */
  #calendarSeenAt: number | null | undefined;

  async onStart(): Promise<void> {
    createHistoryTable(this.ctx.storage.sql);
    migrateLegacyStorage(this.ctx.storage);
    await super.onStart();

    this.document.on("update", (update: Uint8Array) => {
      try {
        appendHistory(this.ctx.storage.sql, update);
      } catch (error) {
        console.error("failed to persist update, resetting", error);
        this.ctx.abort("failed to persist update");
        return;
      }
      this.#historyLength += 1;
      this.compactHistory();
      this.registerCalendar(Date.now());
    });

    this.registerCalendar(null);
  }

  /** Refuses updates too large to store before Yjs applies them. */
  handleMessage(connection: Connection, message: WSMessage): void {
    if (typeof message !== "string" && message.byteLength > MAX_UPDATE_BYTES) {
      connection.close(1009, "update too large");
      return;
    }
    super.handleMessage(connection, message);
  }

  async onLoad(): Promise<void> {
    const history = readHistory(this.ctx.storage.sql);
    for (const { update } of history) Y.applyUpdate(this.document, update);
    this.#historyLength = history.length;
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
      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_UPDATE_BYTES) {
        return Response.json({ error: "calendar too large" }, { status: 413 });
      }
      const event = CalendarEvent(parseJson(new TextDecoder().decode(body)));
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
        const body = encodeHistoryUpdates(
          readHistory(this.ctx.storage.sql).map(({ clock, update }) => ({
            clock: String(clock),
            value: update,
          })),
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

  /** Merges the older half of the history pairwise once it's over the limit. */
  private compactHistory() {
    if (this.#historyLength <= HISTORY_LIMIT) return;

    const { sql } = this.ctx.storage;
    try {
      this.#historyLength -= this.ctx.storage.transactionSync(() => {
        const older = readHistory(sql, Math.floor(this.#historyLength / 2));
        let merged = 0;
        for (let i = 0; i + 1 < older.length; i += 2) {
          const [first, second] = [older[i], older[i + 1]];
          const data = Y.mergeUpdates([first.update, second.update]);
          if (data.byteLength > MAX_UPDATE_BYTES) continue;
          sql.exec(
            "UPDATE history SET data = ? WHERE clock = ?",
            data,
            second.clock,
          );
          sql.exec("DELETE FROM history WHERE clock = ?", first.clock);
          merged += 1;
        }
        return merged;
      });
    } catch (error) {
      console.error("failed to compact history", error);
    }
  }

  /**
   * Records the calendar in the occupancy server's registry once this instance
   * sees an event: loaded from storage on start (creation time unknown, so
   * `null`) or arriving in an update, whether from the POST or a sync.
   */
  private registerCalendar(seenAt: number | null) {
    if (this.#registered || !hasCalendarEvent(this.document)) return;
    if (this.#calendarSeenAt === undefined) this.#calendarSeenAt = seenAt;
    const createdAt = this.#calendarSeenAt;
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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
