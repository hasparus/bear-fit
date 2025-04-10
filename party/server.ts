import type * as Party from "partykit/server";

import * as v from "valibot";
import { onConnect, unstable_getYDoc, type YPartyKitOptions } from "y-partykit";
import { getLevelBulkData } from "y-partykit/storage";
import { Doc } from "yjs";

import { CalendarEvent } from "../app/schemas";
import { initializeEventMap, yDocToJson } from "../app/shared-data";
import { CORS, OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "./shared";

const VERBOSE = process.env.NODE_ENV === "development";

export default class EditorServer implements Party.Server {
  doc: Doc | null = null;

  event: CalendarEvent | null = null;

  // TODO: Test how it affects the server. May cause problems with Yjs.
  // options = {
  //   hibernate: true,
  // };

  constructor(public room: Party.Room) {}

  /**
   * Must be the same when calling unstable_getYDoc and onConnect.
   * But at the same time we can't use *the same* object, because `gc` gets added to it, and then we get an error.
   */
  get yPartyKitOptions(): YPartyKitOptions {
    return {
      callback: { handler: (doc) => this.handleYDocChange(doc) },
      persist: { mode: "history" },
    };
  }

  private handleYDocChange(doc: Doc) {
    if (VERBOSE) {
      console.log("↠ handleYDocChange", yDocToJson(doc));
    }
  }

  private async updateCount() {
    const count = [...this.room.getConnections()].length;
    await this.room.context.parties.rooms
      .get(OCCUPANCY_SERVER_SINGLETON_ROOM_ID)
      .fetch({
        body: JSON.stringify({ count, room: this.room.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      .catch((error) => {
        console.error("updateCount", error);
      });
  }

  async onClose(_: Party.Connection) {
    void this.updateCount();
  }

  async onConnect(conn: Party.Connection) {
    void this.updateCount();

    if (VERBOSE) {
      console.log("↠ onConnect", this.room.id);
    }

    return onConnect(conn, this.room, this.yPartyKitOptions);
  }

  async onRequest(req: Party.Request) {
    const url = new URL(req.url);

    // We only allow CORS requests in development and tests.
    // In prod, the server is deployed together with the client.
    const headers = process.env.NODE_ENV !== "production" ? CORS : undefined;

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers });
    }

    if (req.method === "POST" && url.pathname.startsWith("/parties/main/")) {
      const json = await req.json();
      if (VERBOSE) {
        console.log("↠ onRequest", json);
      }

      try {
        const event = v.parse(CalendarEvent, json);
        if (this.event) {
          return Response.json(
            { error: "event already created" },
            { headers, status: 403 },
          );
        } else {
          initializeEventMap(
            await unstable_getYDoc(this.room, this.yPartyKitOptions),
            event,
          );
          return Response.json({ message: "created" }, { headers });
        }
      } catch (error) {
        console.error(error);
        return Response.json(
          { error: "invalid event" },
          { headers, status: 400 },
        );
      }
    }

    if (req.method === "GET") {
      if (url.pathname === `/parties/main/${this.room.id}/history`) {
        const updates = await getLevelUpdates(this.room.storage, this.room.id);

        return new Response(encodeUpdatesToOneUint8Array(updates), {
          headers: {
            ...headers,
            "Content-Type": "application/octet-stream",
          },
        });
      }

      if (url.pathname === "/parties/main/status") {
        return new Response("ok", { headers });
      }

      return Response.json(
        yDocToJson(await unstable_getYDoc(this.room, this.yPartyKitOptions)),
        { headers },
      );
    }

    return Response.json({ message: "not found" }, { headers, status: 404 });
  }
}

// #region HACK: Copied from y-partykit/storage.ts (it wasn't exported, probably for a reason)

/**
 *
 * Get all document updates for a specific document.
 */
async function getLevelUpdates(
  db: Party.Storage,
  docName: string,
  opts: {
    keys: boolean;
    limit?: number;
    reverse?: boolean;
    values: boolean;
  } = {
    keys: false,
    values: true,
  },
): Promise<Datum[]> {
  return getLevelBulkData(db, {
    gte: createDocumentUpdateKey(docName, 0),
    lt: createDocumentUpdateKey(docName, BINARY_BITS_32),
    ...opts,
  });
}

interface Datum {
  key: StorageKey;
  value: Uint8Array;
}

type StorageKey = DocumentStateVectorKey | DocumentUpdateKey;

/**
 * Create a unique key for a update message.
 * We encode the result using `keyEncoding` which expects an array.
 */
type DocumentUpdateKey = ["v1", string, "update", number];
type DocumentStateVectorKey = ["v1_sv", string];

function createDocumentUpdateKey(
  docName: string,
  clock: number,
): DocumentUpdateKey {
  return ["v1", docName, "update", clock];
}

const BINARY_BITS_32 = 0xffffffff;
// #endregion

function encodeUpdatesToOneUint8Array(updates: Datum[]): Uint8Array {
  const textEncoder = new TextEncoder();
  const separator = textEncoder.encode("\n\n");
  const parts: Uint8Array[] = [];

  for (const update of updates) {
    const clock = update.key[3] ?? "sv"; // we either have a clock number or it's state vector
    parts.push(textEncoder.encode(`${clock}`));
    parts.push(separator);
    parts.push(update.value);
    parts.push(separator); // if it's the last update, we end the file with LF
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
