import { type } from "arktype";

type RoomId = string;
type ConnectionsCount = number;
export type Rooms = Record<RoomId, ConnectionsCount>;

export const OCCUPANCY_SERVER_SINGLETON_ROOM_ID = "index";
export const AUTH_CHALLENGE_PREFIX = "dashboard:";

export const UpdateFromRoom = type({
  count: "number.integer >= 0",
  room: "string > 0",
});
export type UpdateFromRoom = typeof UpdateFromRoom.infer;

export const RegisteredCalendar = type({
  id: "string > 0",
  /** `null` when unknown: calendars found on Durable Object start are backfilled. */
  createdAt: "number.integer | null",
});
export type RegisteredCalendar = typeof RegisteredCalendar.infer;

export const ClientMessage = type({
  type: "'auth'",
  payload: {
    signature: "string",
  },
});
export type ClientMessage = typeof ClientMessage.infer;

export type ServerMessage =
  | { type: "admin"; calendars: RegisteredCalendar[]; rooms: Rooms }
  | { type: "calendar"; calendar: RegisteredCalendar }
  | { type: "challenge"; challenge: string }
  | { type: "public"; info: PublicRoomInfo }
  | { type: "rooms"; rooms: Rooms };

export function makePublicRoomInfo(rooms: Rooms) {
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
