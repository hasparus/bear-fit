import type { CalendarEvent } from "../schemas";

import { serverUrl } from "./serverUrl";

export interface EventResponse {
  availability: Record<string, true>;
  event: Partial<CalendarEvent>;
  expiredAt: number | null;
  names: Record<string, string>;
}

export async function getEvent(roomId: string): Promise<EventResponse> {
  const res = await fetch(`${serverUrl}/parties/main/${roomId}`);
  if (!res.ok) {
    throw new Error(`getEvent failed: ${res.status}`);
  }
  return res.json() as Promise<EventResponse>;
}
