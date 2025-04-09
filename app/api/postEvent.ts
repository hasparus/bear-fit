import type { CalendarEvent } from "../schemas";

import { serverUrl } from "./serverUrl";

export async function postEvent(
  calendarEvent: CalendarEvent,
): Promise<unknown> {
  const res = await fetch(`${serverUrl}/parties/main/${calendarEvent.id}`, {
    body: JSON.stringify(calendarEvent),
    method: "POST",
  });

  if (res.status === 404) {
    throw new Error("server not found");
  }

  const json = await res.json();

  // TODO: If the status was not 200, we should show an error message and retry.
  return json;
}
