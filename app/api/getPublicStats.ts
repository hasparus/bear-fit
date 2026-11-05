import type { PublicStats } from "../../party/rooms";

import { serverUrl } from "./serverUrl";

const RETRY_DELAYS_MS = [500, 2000];

export async function getPublicStats() {
  for (const delay of RETRY_DELAYS_MS) {
    try {
      return await fetchPublicStats();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return fetchPublicStats();
}

async function fetchPublicStats() {
  const res = await fetch(`${serverUrl}/parties/rooms/index`);
  if (!res.ok) throw new Error(`stats request failed: ${res.status}`);
  return (await res.json()) as PublicStats;
}
