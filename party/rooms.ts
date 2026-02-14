import { type } from "arktype";

type RoomId = string;
type ConnectionsCount = number;
export type Rooms = Record<RoomId, ConnectionsCount>;

// we could use a jwt with iat and exp, but this is fine for now
export const HARDCODED_AUTH_MESSAGE_NOT_SMART = "dashboard";
export const AUTHORIZATION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 1; // 1 day

export const UpdateFromRoom = type({ count: "number", room: "string" });
export type UpdateFromRoom = typeof UpdateFromRoom.infer;

export const ClientMessage = type({
  type: "'auth'",
  payload: {
    signature: "string",
  },
});
export type ClientMessage = typeof ClientMessage.infer;

export type ServerMessage = PublicRoomInfo | Rooms;

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

export function base64ToArrayBuffer(base64: string) {
  const latin1 = atob(base64);
  const len = latin1.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    view[i] = latin1.charCodeAt(i);
  }
  return buffer;
}

export const textEncoder = new TextEncoder();
