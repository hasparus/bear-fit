import type { PublicStats } from "../../party/rooms";

import { serverUrl } from "./serverUrl";

const STATS_URL = `${serverUrl}/parties/rooms/index`;
const RETRY_DELAYS_MS = [500, 2000];

export async function getPublicStats() {
  for (const delay of RETRY_DELAYS_MS) {
    const res = await fetch(STATS_URL).catch(() => null);
    if (res && res.status < 500) return readPublicStats(res);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return readPublicStats(await fetch(STATS_URL));
}

async function readPublicStats(res: Response) {
  if (!res.ok) throw new Error(`stats request failed: ${res.status}`);
  return (await res.json()) as PublicStats;
}
