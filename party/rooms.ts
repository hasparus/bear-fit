import type * as Party from "partykit/server";

export type Rooms = Record<string, number>;
export const SINGLETON_ROOM_ID = "index";

export default class OccupancyServer implements Party.Server {
  // Track room occupancy
  rooms: Rooms;

  constructor(public room: Party.Room) {
    this.rooms = {};
  }

  onConnect(connection: Party.Connection) {
    connection.send(JSON.stringify({ rooms: this.rooms, type: "rooms" }));
  }

  async onRequest(req: Party.Request) {
    if (req.method === "GET") {
      return new Response(
        `Hi! This is party '${this.room.name}' and room '${this.room.id}'!`
      );
    }

    if (req.method === "POST") {
      const { count, room }: { count: number; room: string } = await req.json();
      this.rooms[room] = count;
      this.room.broadcast(JSON.stringify({ rooms: this.rooms, type: "rooms" }));
      return Response.json({ ok: true });
    }

    // Always return a Response
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
}
