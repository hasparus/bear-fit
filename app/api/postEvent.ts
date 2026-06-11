import type { CalendarEvent } from "../schemas";

import { serverUrl } from "./serverUrl";

export async function postEvent(
  calendarEvent: CalendarEvent,
): Promise<unknown> {
  const res = await fetch(`${serverUrl}/parties/main/${calendarEvent.id}`, {
    body: JSON.stringify(calendarEvent),
    method: "POST",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    const detail = body?.error ?? "";
    throw new Error(
      `creating event failed (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  return (await res.json()) as unknown;
}
