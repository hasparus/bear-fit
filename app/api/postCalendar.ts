import { serverUrl } from "./serverUrl";

/**
 * Sends the Yjs update that created the calendar. The server applies the same
 * update the WebSocket sync carries, so whichever lands second is a no-op, and
 * `keepalive` lets it finish if the user leaves the page right away.
 */
export async function postCalendar(
  calendarId: string,
  update: Uint8Array,
): Promise<void> {
  const res = await fetch(`${serverUrl}/parties/main/${calendarId}`, {
    body: update,
    headers: { "Content-Type": "application/octet-stream" },
    keepalive: true,
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`creating calendar failed: ${res.status}`);
  }
}
