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
import { History, MAX_UPDATE_BYTES } from "./history";
import { migrateLegacyStorage } from "./legacyStorage";
import {
  OCCUPANCY_SERVER_SINGLETON_ROOM_ID,
  type RegisteredCalendar,
} from "./rooms";

/**
 * One Durable Object holds one calendar. Its Yjs document is persisted only as
 * the `history` log: every update is appended as it happens and the document
 * is rebuilt from the log on start.
 */
export class EditorPartyServer extends YServer<Env> {
  #history = new History(this.ctx.storage);
  #occupancyReport = Promise.resolve();
  /** Kept until the registry confirms it, so a retry sends the first sighting. */
  #registration?: "done" | RegisteredCalendar;

  async onStart(): Promise<void> {
    migrateLegacyStorage(this.ctx.storage);
    await super.onStart();

    this.document.on("update", (update: Uint8Array) => {
      try {
        this.#history.append(update);
      } catch (error) {
        console.error("failed to persist update, resetting", error);
        this.ctx.abort("failed to persist update");
        return;
      }
      this.registerCalendar(Date.now());
    });

    this.registerCalendar(null);
  }

  /**
   * Refuses messages too large to store before Yjs applies them, and drops
   * pending structs (updates waiting on a missing dependency) once they grow
   * that large, since they'd be stored as one update when unblocked. Yjs keeps
   * them in the V2 encoding, so they're measured as the V1 the log stores.
   */
  handleMessage(connection: Connection, message: WSMessage): void {
    if (typeof message !== "string" && message.byteLength > MAX_UPDATE_BYTES) {
      connection.close(1009, "update too large");
      return;
    }
    super.handleMessage(connection, message);

    const { store } = this.document;
    const pending = [store.pendingStructs?.update, store.pendingDs];
    const pendingBytes = pending.reduce(
      (total, update) =>
        total + (update ? Y.convertUpdateFormatV2ToV1(update).byteLength : 0),
      0,
    );
    if (pendingBytes > MAX_UPDATE_BYTES) {
      store.pendingStructs = null;
      store.pendingDs = null;
      connection.close(1009, "pending updates too large");
    }
  }

  async onLoad(): Promise<void> {
    for (const { update } of this.#history.load()) {
      Y.applyUpdate(this.document, update);
    }
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
          this.#history.rows().map(({ clock, update }) => ({
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

  /**
   * Records the calendar in the occupancy server's registry once this instance
   * sees an event: loaded from storage on start (creation time unknown, so
   * `null`) or arriving in an update, whether from the POST or a sync.
   */
  private registerCalendar(seenAt: number | null) {
    const pending = this.#registration;
    if (pending === "done" || !hasCalendarEvent(this.document)) return;
    const calendar = pending ?? { id: this.name, createdAt: seenAt };
    this.#registration = "done";
    getServerByName(this.env.rooms, OCCUPANCY_SERVER_SINGLETON_ROOM_ID)
      .then((registry) => registry.registerCalendar(calendar))
      .catch((error) => {
        this.#registration = calendar;
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
