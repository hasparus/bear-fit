import type { APIRequestContext } from "@playwright/test";

import { decodeHistoryUpdates } from "../../app/decodeHistoryUpdates";

/** A calendar's document as the server has it. */
export async function serverDoc(request: APIRequestContext, id: string) {
  const res = await request.get(`/parties/main/${id}`);
  return (await res.json()) as {
    availability: Record<string, boolean>;
    event: Record<string, unknown>;
    names: Record<string, string>;
  };
}

/** The number of rows in a calendar's server-side history log. */
export async function historyLength(request: APIRequestContext, id: string) {
  const res = await request.get(`/parties/main/${id}/history`);
  return decodeHistoryUpdates(await res.body()).length;
}
