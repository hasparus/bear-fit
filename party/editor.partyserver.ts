import { getServerByName, type Connection, type ConnectionContext } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

import { CalendarEvent } from "../app/schemas";
import {
  hasCalendarEvent,
  initializeEventMap,
  yDocToJson
} from "../app/shared-data";
import { CORS, OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "./shared";
import { OccupancyPartyServer } from "./occupancy.partyserver";

type EditorEnv = {
  rooms: DurableObjectNamespace<OccupancyPartyServer>;
};

type UpdateRow = {
  clock: number;
  update: ArrayBufferLike;
};

const TABLE_DOCUMENTS = "documents";
const TABLE_UPDATES = "document_updates";

const TEXT_ENCODER = new TextEncoder();
const HISTORY_SEPARATOR = TEXT_ENCODER.encode("\n\n");

export class EditorPartyServer extends YServer<EditorEnv> {
  static callbackOptions = {
    debounceWait: 750,
    debounceMaxWait: 5_000,
    timeout: 5_000
  };

  constructor(...args: ConstructorParameters<typeof YServer<EditorEnv>>) {
    super(...args);
    this.env = args[1];
  }

  protected override readonly env: EditorEnv;

  #lastClock = 0;
  #historyInitialized = false;

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
        this.name
      )
    ];

    if (row && row.state instanceof ArrayBuffer) {
      Y.applyUpdate(this.document, new Uint8Array(row.state));
    }
  }

  async onSave(): Promise<void> {
    const update = Y.encodeStateAsUpdate(this.document);
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO ${TABLE_DOCUMENTS} (id, state) VALUES (?, ?)`,
      this.name,
      update
    );
  }

  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    await super.onConnect(connection, ctx);
    void this.updateOccupancyCount();
  }

  async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    await super.onClose(connection, code, reason, wasClean);
    void this.updateOccupancyCount();
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const headers =
      process.env.NODE_ENV !== "production" ? CORS : undefined;

    if (request.method === "OPTIONS") {
      return new Response("ok", { headers });
    }

    if (request.method === "POST" && url.pathname.startsWith("/parties/main/")) {
      try {
        const payload = await request.json();
        const event = CalendarEvent.assert(payload);

        if (hasCalendarEvent(this.document)) {
          return Response.json(
            { error: "event already created" },
            { headers, status: 403 }
          );
        }

        initializeEventMap(this.document, event);
        await this.onSave();

        return Response.json({ message: "created" }, { headers });
      } catch (error) {
        console.error("failed to create event", error);
        return Response.json(
          { error: "invalid event" },
          { headers, status: 400 }
        );
      }
    }

    if (request.method === "GET") {
      if (url.pathname === `/parties/main/${this.name}/history`) {
        const updates = this.loadUpdates();
        const body = this.encodeHistory(updates);

        return new Response(body, {
          headers: {
            ...headers,
            "Content-Type": "application/octet-stream"
          }
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
      )`
    );

    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS ${TABLE_UPDATES} (
        doc_id TEXT NOT NULL,
        clock INTEGER NOT NULL,
        update BLOB NOT NULL,
        PRIMARY KEY (doc_id, clock)
      )`
    );
  }

  private loadLastClock(): number {
    const [row] = [
      ...this.ctx.storage.sql.exec(
        `SELECT clock FROM ${TABLE_UPDATES} WHERE doc_id = ? ORDER BY clock DESC LIMIT 1`,
        this.name
      )
    ];

    return row ? Number(row.clock) : 0;
  }

  private loadUpdates(): UpdateRow[] {
    return [
      ...this.ctx.storage.sql.exec(
        `SELECT clock, update FROM ${TABLE_UPDATES} WHERE doc_id = ? ORDER BY clock ASC`,
        this.name
      )
    ].map((row) => {
      const raw = row.update as unknown;
      let update: ArrayBufferLike;
      if (raw instanceof ArrayBuffer || raw instanceof SharedArrayBuffer) {
        update = raw;
      } else if (ArrayBuffer.isView(raw as ArrayBufferView)) {
        update = (raw as ArrayBufferView).buffer;
      } else {
        console.warn("unexpected update payload", typeof raw);
        update = new Uint8Array().buffer;
      }
      return {
        clock: Number(row.clock),
        update
      } satisfies UpdateRow;
    });
  }

  private persistIncrementalUpdate(update: Uint8Array) {
    this.#lastClock += 1;
    try {
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO ${TABLE_UPDATES} (doc_id, clock, update) VALUES (?, ?, ?)`,
        this.name,
        this.#lastClock,
        update
      );
    } catch (error) {
      console.error("failed to persist update", error);
    }
  }

  private encodeHistory(rows: UpdateRow[]): Uint8Array {
    const parts: Uint8Array[] = [];
    const appendPair = (label: string, value: Uint8Array) => {
      parts.push(TEXT_ENCODER.encode(label));
      parts.push(HISTORY_SEPARATOR);
      parts.push(value);
      parts.push(HISTORY_SEPARATOR);
    };

    appendPair("sv", Y.encodeStateAsUpdate(this.document));

    for (const row of rows) {
      appendPair(String(row.clock), new Uint8Array(row.update));
    }

    const totalSize = parts.reduce((acc, part) => acc + part.length, 0);
    const body = new Uint8Array(totalSize);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }
    return body;
  }

  private async updateOccupancyCount() {
    try {
      const stub = await getServerByName(
        this.env.rooms,
        OCCUPANCY_SERVER_SINGLETON_ROOM_ID
      );
      const count = Array.from(this.getConnections()).length;
      await stub.fetch("https://occupancy.internal/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, room: this.name })
      });
    } catch (error) {
      console.error("failed to notify occupancy server", error);
    }
  }
}
