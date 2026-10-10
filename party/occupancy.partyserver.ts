import { type Connection, Server } from "partyserver";

import type { Env } from "./worker";

import {
  AUTH_CHALLENGE_PREFIX,
  ClientMessage,
  makePublicRoomInfo,
  RegisteredCalendar,
  type Rooms,
  type ServerMessage,
  UpdateFromRoom,
} from "./rooms";

const AUTH_CHALLENGE_TTL = 1000 * 60 * 5;
const AUTHORIZATION_TTL = 1000 * 60 * 60 * 24;

type DashboardState =
  | { authorizedUntil: number }
  | { challenge: string; issuedAt: number };
type DashboardConnection = Connection<DashboardState>;

export class OccupancyPartyServer extends Server<Env> {
  private rooms: Rooms = {};

  async onStart(): Promise<void> {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS calendars (
        id TEXT PRIMARY KEY,
        created_at INTEGER
      )`,
    );
    const stored = await this.ctx.storage.get<string>("rooms");
    if (stored) this.rooms = JSON.parse(stored);
  }

  async onConnect(connection: DashboardConnection): Promise<void> {
    send(connection, { type: "public", info: makePublicRoomInfo(this.rooms) });
    this.issueChallenge(connection);
  }

  async onMessage(
    connection: DashboardConnection,
    message: ArrayBuffer | string,
  ): Promise<void> {
    if (typeof message !== "string") {
      throw new Error("invalid message");
    }

    const { payload } = ClientMessage.assert(JSON.parse(message));

    const attempt = connection.state;
    this.issueChallenge(connection);

    if (
      attempt &&
      "challenge" in attempt &&
      Date.now() - attempt.issuedAt <= AUTH_CHALLENGE_TTL &&
      (await this.verifySignature(payload.signature, attempt.challenge))
    ) {
      connection.setState({ authorizedUntil: Date.now() + AUTHORIZATION_TTL });
      connection.send(this.adminMessage());
    }
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return Response.json(makePublicRoomInfo(this.rooms));
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  async updateRoomCount(update: UpdateFromRoom): Promise<void> {
    const { count, room } = UpdateFromRoom.assert(update);

    if (count === 0) {
      Reflect.deleteProperty(this.rooms, room);
    } else {
      this.rooms[room] = count;
    }

    await this.ctx.storage.put("rooms", JSON.stringify(this.rooms));

    this.broadcast(
      JSON.stringify({
        type: "public",
        info: makePublicRoomInfo(this.rooms),
      } satisfies ServerMessage),
    );
    this.notifyAdmins({ type: "rooms", rooms: this.rooms });
  }

  async registerCalendar(calendar: RegisteredCalendar): Promise<void> {
    const { id, createdAt } = RegisteredCalendar.assert(calendar);
    const { rowsWritten } = this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO calendars (id, created_at) VALUES (?, ?)",
      id,
      createdAt,
    );
    if (rowsWritten > 0) {
      this.notifyAdmins({ type: "calendar", calendar: { id, createdAt } });
    }
  }

  private issueChallenge(connection: DashboardConnection) {
    const challenge = crypto.randomUUID();
    connection.setState({ challenge, issuedAt: Date.now() });
    send(connection, { type: "challenge", challenge });
  }

  private async verifySignature(signature: string, challenge: string) {
    try {
      const publicKey = await crypto.subtle.importKey(
        "raw",
        base64ToBytes(this.env.PUBLIC_KEY_B64),
        "Ed25519",
        false,
        ["verify"],
      );
      return await crypto.subtle.verify(
        "Ed25519",
        publicKey,
        base64ToBytes(signature),
        new TextEncoder().encode(AUTH_CHALLENGE_PREFIX + challenge),
      );
    } catch (error) {
      console.error("dashboard auth verification failed", error);
      return false;
    }
  }

  private adminMessage() {
    const calendars = this.ctx.storage.sql
      .exec<{ id: string; createdAt: number | null }>(
        `SELECT id, created_at AS createdAt FROM calendars
         ORDER BY created_at DESC NULLS LAST, id`,
      )
      .toArray();
    return JSON.stringify({
      type: "admin",
      calendars,
      rooms: this.rooms,
    } satisfies ServerMessage);
  }

  private notifyAdmins(message: ServerMessage) {
    for (const connection of this.getConnections<DashboardState>()) {
      const { state } = connection;
      if (!state || !("authorizedUntil" in state)) continue;

      if (state.authorizedUntil < Date.now()) {
        this.issueChallenge(connection);
      } else {
        send(connection, message);
      }
    }
  }
}

function send(connection: Connection, message: ServerMessage) {
  connection.send(JSON.stringify(message));
}

function base64ToBytes(base64: string) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
