import { type } from "arktype";
import { type Connection, Server } from "partyserver";

import {
  AUTHORIZATION_EXPIRATION_TIME,
  base64ToArrayBuffer,
  ClientMessage,
  HARDCODED_AUTH_MESSAGE_NOT_SMART,
  makePublicRoomInfo,
  type Rooms,
  textEncoder,
  UpdateFromRoom,
} from "./rooms";

interface OccupancyEnv {
  PUBLIC_KEY_B64: string;
}

export class OccupancyPartyServer extends Server<OccupancyEnv> {
  constructor(...args: ConstructorParameters<typeof Server<OccupancyEnv>>) {
    super(...args);
    const [, env] = args;
    this.env = env;
    this.publicKeyPromise = this.importPublicKey(env.PUBLIC_KEY_B64);
  }

  protected override readonly env: OccupancyEnv;

  private rooms: Rooms = {};
  private readonly authorizedConnections = new Map<string, number>();
  private readonly publicKeyPromise: Promise<CryptoKey>;

  async onStart(): Promise<void> {
    await this.loadFromStorage();
  }

  async onConnect(connection: Connection): Promise<void> {
    connection.send(JSON.stringify(makePublicRoomInfo(this.rooms)));
  }

  async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    await super.onClose(connection, code, reason, wasClean);
    this.authorizedConnections.delete(connection.id);
  }

  async onMessage(
    connection: Connection,
    message: ArrayBuffer | string,
  ): Promise<void> {
    if (typeof message !== "string") {
      throw new Error("invalid message");
    }

    const parsed = ClientMessage.assert(JSON.parse(message));

    if (parsed.type === "auth") {
      try {
        const verified = await this.verifySignature(parsed.payload.signature);
        if (verified) {
          this.authorizeConnection(connection);
        }
      } catch (error) {
        console.error("dashboard auth verification failed", error);
      }
      return;
    }

    throw new Error("invalid message");
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return Response.json(makePublicRoomInfo(this.rooms));
    }

    if (request.method === "POST") {
      const body = await request.json();
      const validated = UpdateFromRoom(body);
      if (validated instanceof type.errors) {
        return Response.json({ error: validated.summary }, { status: 400 });
      }

      if (validated.count === 0) {
        delete this.rooms[validated.room];
      } else {
        this.rooms[validated.room] = validated.count;
      }

      await this.saveToStorage();
      this.broadcast(JSON.stringify(makePublicRoomInfo(this.rooms)));
      this.notifyAuthorizedConnections();

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  private async loadFromStorage() {
    try {
      const stored = await this.ctx.storage.get<string>("rooms");
      if (stored) {
        this.rooms = { ...this.rooms, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error("failed to load rooms from storage", error);
    }
  }

  private async saveToStorage() {
    try {
      await this.ctx.storage.put("rooms", JSON.stringify(this.rooms));
    } catch (error) {
      console.error("failed to persist rooms", error);
    }
  }

  private async importPublicKey(value: string | undefined): Promise<CryptoKey> {
    if (!value) {
      throw new Error(
        "PUBLIC_KEY_B64 environment variable must be set to an Ed25519 public key.",
      );
    }

    return crypto.subtle.importKey(
      "raw",
      base64ToArrayBuffer(value),
      "Ed25519",
      false,
      ["verify"],
    );
  }

  private async verifySignature(signatureB64: string): Promise<boolean> {
    try {
      const encoded = textEncoder.encode(HARDCODED_AUTH_MESSAGE_NOT_SMART);
      const signature = base64ToArrayBuffer(signatureB64);
      const publicKey = await this.publicKeyPromise;
      return crypto.subtle.verify(
        { name: "Ed25519" },
        publicKey,
        signature,
        encoded,
      );
    } catch (error) {
      console.error("failed to verify signature", error);
      return false;
    }
  }

  private authorizeConnection(connection: Connection) {
    connection.send(JSON.stringify(this.rooms));
    this.authorizedConnections.set(
      connection.id,
      Date.now() + AUTHORIZATION_EXPIRATION_TIME,
    );
  }

  private notifyAuthorizedConnections() {
    const payload = JSON.stringify(this.rooms);
    const now = Date.now();

    for (const [connectionId, expiresAt] of this.authorizedConnections) {
      if (expiresAt < now) {
        this.authorizedConnections.delete(connectionId);
        continue;
      }

      const target = this.getConnection(connectionId);
      if (target) {
        try {
          target.send(payload);
        } catch (error) {
          console.error(
            "failed to send update to authorized connection",
            error,
          );
        }
      }
    }
  }
}
