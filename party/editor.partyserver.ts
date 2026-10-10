import {
  type Connection,
  type ConnectionContext,
  getServerByName,
} from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

import { encodeHistoryUpdates } from "../app/encodeHistoryUpdates";
import { CalendarEvent } from "../app/schemas";
import {
  hasCalendarEvent,
  initializeCalendarMap,
  yDocToJson,
} from "../app/shared-data";
import { OccupancyPartyServer } from "./occupancy.partyserver";
import { CORS, OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "./shared";

interface EditorEnv {
  rooms: DurableObjectNamespace<OccupancyPartyServer>;
}

interface UpdateRow {
  clock: number;
  update: Uint8Array;
}

const TABLE_DOCUMENTS = "documents";
const TABLE_UPDATES = "document_updates";

export class EditorPartyServer extends YServer<EditorEnv> {
  static callbackOptions = {
    debounceMaxWait: 5_000,
    debounceWait: 750,
    timeout: 5_000,
  };

  constructor(...args: ConstructorParameters<typeof YServer<EditorEnv>>) {
    super(...args);
    this.env = args[1];
  }

  protected override readonly env: EditorEnv;

  #lastClock = 0;
  #historyInitialized = false;
  #occupancyReport = Promise.resolve();

  async onStart(): Promise<void> {
    this.ensureTables();
    this.#lastClock = this.loadLastClock();

    await super.onStart();

    if (!this.#historyInitialized) {
      this.document.on("update", (update) => {
        this.persistIncrementalUpdate(update);
      });
      this.#historyInitialized = true;
    }
  }

  async onLoad(): Promise<void> {
    const [row] = [
      ...this.ctx.storage.sql.exec(
        `SELECT state FROM ${TABLE_DOCUMENTS} WHERE id = ? LIMIT 1`,
        this.name,
      ),
    ];

    const state = row && blobToBytes(row.state);
    if (state) {
      Y.applyUpdate(this.document, state);
    }
  }

  async onSave(): Promise<void> {
    const update = Y.encodeStateAsUpdate(this.document);
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO ${TABLE_DOCUMENTS} (id, state) VALUES (?, ?)`,
      this.name,
      update,
    );
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
    const url = new URL(request.url);
    const headers = process.env.NODE_ENV !== "production" ? CORS : undefined;

    if (request.method === "OPTIONS") {
      return new Response("ok", { headers });
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/parties/main/")
    ) {
      try {
        const payload = await request.json();
        const event = CalendarEvent.assert(payload);

        if (hasCalendarEvent(this.document)) {
          return Response.json(
            { error: "calendar already created" },
            { headers, status: 403 },
          );
        }

        initializeCalendarMap(this.document, event);
        await this.onSave();

        return Response.json({ message: "created" }, { headers });
      } catch (error) {
        console.error("failed to create calendar", error);
        return Response.json(
          { error: "invalid calendar" },
          { headers, status: 400 },
        );
      }
    }

    if (request.method === "GET") {
      if (url.pathname === `/parties/main/${this.name}/history`) {
        const body = encodeHistoryUpdates(
          this.loadUpdates().map((row) => ({
            clock: String(row.clock),
            value: row.update,
          })),
        );

        return new Response(body, {
          headers: {
            ...headers,
            "Content-Type": "application/octet-stream",
          },
        });
      }

      if (url.pathname === "/parties/main/status") {
        return new Response("ok", { headers });
      }

      if (url.pathname === `/parties/main/${this.name}`) {
        return Response.json(yDocToJson(this.document), { headers });
      }
    }

    return Response.json({ message: "not found" }, { headers, status: 404 });
  }

  private ensureTables() {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS ${TABLE_DOCUMENTS} (
        id TEXT PRIMARY KEY,
        state BLOB NOT NULL
      )`,
    );

    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS ${TABLE_UPDATES} (
        doc_id TEXT NOT NULL,
        clock INTEGER NOT NULL,
        update_data BLOB NOT NULL,
        PRIMARY KEY (doc_id, clock)
      )`,
    );
  }

  private loadLastClock(): number {
    const [row] = [
      ...this.ctx.storage.sql.exec(
        `SELECT clock FROM ${TABLE_UPDATES} WHERE doc_id = ? ORDER BY clock DESC LIMIT 1`,
        this.name,
      ),
    ];

    return row ? Number(row.clock) : 0;
  }

  private loadUpdates(): UpdateRow[] {
    return [
      ...this.ctx.storage.sql.exec(
        `SELECT clock, update_data FROM ${TABLE_UPDATES} WHERE doc_id = ? ORDER BY clock ASC`,
        this.name,
      ),
    ].map((row) => {
      const update = blobToBytes(row.update_data);
      if (!update) {
        console.warn("unexpected update payload", typeof row.update_data);
      }
      return {
        clock: Number(row.clock),
        update: update ?? new Uint8Array(),
      } satisfies UpdateRow;
    });
  }

  private persistIncrementalUpdate(update: Uint8Array) {
    this.#lastClock += 1;
    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO ${TABLE_UPDATES} (doc_id, clock, update_data) VALUES (?, ?, ?)`,
        this.name,
        this.#lastClock,
        update,
      );
    } catch (error) {
      console.error("failed to persist update", error);
    }
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

/** SQLite BLOB columns come back as ArrayBuffer; copy views by their exact range. */
function blobToBytes(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}
