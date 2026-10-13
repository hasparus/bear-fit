import type { APIRequestContext } from "@playwright/test";

import { decodeHistoryUpdates } from "../../app/decodeHistoryUpdates";

/** The number of rows in a calendar's server-side history log. */
export async function historyLength(request: APIRequestContext, id: string) {
  const res = await request.get(`/parties/main/${id}/history`);
  return decodeHistoryUpdates(await res.body()).length;
}
