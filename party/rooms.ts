import type * as Party from "partykit/server";

import { type } from "arktype";

type RoomId = string;
type ConnectionsCount = number;
export type Rooms = Record<RoomId, ConnectionsCount>;

// we could use a jwt with iat and exp, but this is fine for now
const HARDCODED_AUTH_MESSAGE_NOT_SMART = "dashboard";
const AUTHORIZATION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 1; // 1 day

const UpdateFromRoom = type({ count: "number", room: "string" });
export type UpdateFromRoom = typeof UpdateFromRoom.infer;

const ClientMessage = type({
  type: "'auth'",
  payload: {
    signature: "string",
  },
});
export type ClientMessage = typeof ClientMessage.infer;

export type ServerMessage = PublicRoomInfo | Rooms;

const PUBLIC_KEY_B64 = process.env.PUBLIC_KEY_B64;

if (!PUBLIC_KEY_B64) {
  throw new Error(
    "PUBLIC_KEY_B64 environment variable must be set to an Ed25519 public key.",
  );
} else if (
  process.env.NODE_ENV === "production" &&
  PUBLIC_KEY_B64.startsWith("yAL")
) {
  throw new Error("Deployed with test pubkey");
}

const PUBLIC_KEY = await crypto.subtle.importKey(
  "raw",
  base64ToArrayBuffer(PUBLIC_KEY_B64),
  "Ed25519",
  false,
  ["verify"],
);

const textEncoder = new TextEncoder();

// TODO: On alarm, query storage of all rooms and sum up the users and the availabilities.
export default class OccupancyServer implements Party.Server {
  rooms: Rooms = {};
  authorizedConnections = new Set<{ id: string; expiresAt: number }>();

  constructor(public room: Party.Room) {}

  onStart() {
    return this.loadFromStorage();
  }

  onClose() {
    return this.saveToStorage();
  }

  onConnect(connection: Party.Connection) {
    connection.send(JSON.stringify(makePublicRoomInfo(this.rooms)));
  }

  async onMessage(message: string, connection: Party.Connection) {
    const action = ClientMessage.assert(JSON.parse(message));

    if (action.type === "auth") {
      try {
        const encoded = textEncoder.encode(HARDCODED_AUTH_MESSAGE_NOT_SMART);
        const signature = base64ToArrayBuffer(action.payload.signature);
        const verified = await crypto.subtle.verify(
          { name: "Ed25519" },
          await PUBLIC_KEY,
          signature,
          encoded,
        );
        if (verified) {
          this.authorizeConnection(connection);
        }
      } catch (error) {
        console.error("dashboard auth verification failed", error);
      }

      return;
    } else {
      throw new Error("invalid message");
    }
  }

  async onRequest(req: Party.Request) {
    if (req.method === "GET") {
      // let path = new URL(req.url).pathname;
      // path = path.replace(`/parties/rooms/${this.room.id}`, "");
      return new Response(JSON.stringify(makePublicRoomInfo(this.rooms)));
    }

    if (req.method === "POST") {
      const parsed = UpdateFromRoom(await req.json());
      if (parsed instanceof type.errors) {
        return Response.json({ error: parsed.summary }, { status: 400 });
      }

      if (parsed.count === 0) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.rooms[parsed.room];
      } else {
        this.rooms[parsed.room] = parsed.count;
      }

      void this.saveToStorage();

      this.room.broadcast(JSON.stringify(makePublicRoomInfo(this.rooms)));

      for (const connection of this.authorizedConnections) {
        if (connection.expiresAt < Date.now()) {
          this.authorizedConnections.delete(connection);
        } else {
          this.room
            .getConnection(connection.id)
            ?.send(JSON.stringify(this.rooms));
        }
      }

      return Response.json({ ok: true });
    }

    // Always return a Response
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  private async loadFromStorage() {
    const rooms = await this.room.storage.get("rooms");
    let parsed = {};
    try {
      if (rooms) {
        parsed = JSON.parse(`${rooms}`);
      }
    } catch {
      // do nothing
    }

    this.rooms = { ...this.rooms, ...parsed };
  }

  private async saveToStorage() {
    await this.room.storage.put("rooms", JSON.stringify(this.rooms));
  }

  private authorizeConnection(connection: Party.Connection) {
    connection.send(JSON.stringify(this.rooms));
    this.authorizedConnections.add({
      id: connection.id,
      expiresAt: Date.now() + AUTHORIZATION_EXPIRATION_TIME,
    });
  }
}

function makePublicRoomInfo(rooms: Rooms) {
  return {
    rooms: Object.keys(rooms).length,
    activeConnections: Object.values(rooms).reduce(
      (acc, count) => acc + count,
      0,
    ),
  };
}

export interface PublicRoomInfo {
  activeConnections: number;
  rooms: number;
}

function base64ToArrayBuffer(base64: string) {
  const latin1 = atob(base64);
  const len = latin1.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    view[i] = latin1.charCodeAt(i);
  }
  return buffer;
}
