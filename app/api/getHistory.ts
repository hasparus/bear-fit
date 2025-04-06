import { serverUrl } from "./serverUrl";

export async function getHistory(roomId: string) {
  const res = await fetch(`${serverUrl}/parties/main/${roomId}/history`);
  return res.json();
}
