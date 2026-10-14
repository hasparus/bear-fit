import type { APIRequestContext, APIResponse } from "@playwright/test";

import { decodeHistoryUpdates } from "../../app/decodeHistoryUpdates";
import { expect } from "../index";

/**
 * Sends a request again while vite preview drops it. Its proxy to workerd can
 * lose a request on a stale keep-alive socket and answer with an HTML 500.
 */
export async function retryDropped(send: () => Promise<APIResponse>) {
  let response: APIResponse | undefined;
  await expect(async () => {
    response = await send();
    const contentType = response.headers()["content-type"] ?? "";
    expect(
      response.status() === 500 && contentType.startsWith("text/html"),
      "vite preview dropped the request",
    ).toBe(false);
  }).toPass({ timeout: 10_000 });
  return response!;
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
