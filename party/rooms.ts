import type * as Party from "partykit/server";

type RoomId = string;
type ConnectionsCount = number;
export type Rooms = Record<RoomId, ConnectionsCount>;

export default class OccupancyServer implements Party.Server {
  rooms: Rooms = {};

  constructor(public room: Party.Room) {}

  onStart(): Promise<void> | void {
    this.room.storage.get("rooms").then((rooms) => {
      let parsed = {};
      try {
        if (rooms) {
          parsed = JSON.parse(`${rooms}`);
        }
      } catch {
        // do nothing
      }

      this.rooms = { ...this.rooms, ...parsed };
    });
  }

  onConnect(connection: Party.Connection) {
    connection.send(JSON.stringify(makePublicRoomInfo(this.rooms)));
  }

  async onRequest(req: Party.Request) {
    if (req.method === "GET") {
      // let path = new URL(req.url).pathname;
      // path = path.replace(`/parties/rooms/${this.room.id}`, "");

      return new Response(
        `Hi! This is party '${this.room.name}' and room '${this.room.id}'!`,
      );
    }

    if (req.method === "POST") {
      const { count, room }: { count: number; room: string } = await req.json();
      this.rooms[room] = count;
      // todo: send full data to all admins
      this.room.broadcast(JSON.stringify(makePublicRoomInfo(this.rooms)));

      return Response.json({ ok: true });
    }

    // Always return a Response
    return Response.json({ error: "Method not allowed" }, { status: 405 });
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
