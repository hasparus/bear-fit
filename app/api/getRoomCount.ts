import type { PublicStats } from "../../party/rooms";

import { serverUrl } from "./serverUrl";

export async function getPublicRoomInfo() {
  const res = await fetch(`${serverUrl}/parties/rooms/index`);
  const data = (await res.json()) as PublicStats;
  return data;
}
