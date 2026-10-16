import type { APIRequestContext, APIResponse } from "@playwright/test";

import { decodeHistoryUpdates } from "../../app/decodeHistoryUpdates";

/**
 * vite preview's proxy to workerd can lose a request on a stale keep-alive
 * socket. connect's final handler then answers with its own error page.
 */
const isDroppedByPreview = (response: APIResponse) =>
  response.status() === 500 &&
  response.headers()["content-security-policy"] === "default-src 'none'";

/** Sends a request up to 3 times while vite preview drops it. */
export async function retryDropped(send: () => Promise<APIResponse>) {
  for (let attempt = 1; ; attempt++) {
    const response = await send();
    if (attempt === 3 || !isDroppedByPreview(response)) return response;
  }
}

/** A calendar's document as the server has it. */
export async function serverDoc(request: APIRequestContext, id: string) {
  const res = await retryDropped(() => request.get(`/parties/main/${id}`));
  return (await res.json()) as {
    availability: Record<string, boolean>;
    event: Record<string, unknown>;
    names: Record<string, string>;
  };
}

/** The number of rows in a calendar's server-side history log. */
export async function historyLength(request: APIRequestContext, id: string) {
  const res = await retryDropped(() =>
    request.get(`/parties/main/${id}/history`),
  );
  return decodeHistoryUpdates(await res.body()).length;
}
