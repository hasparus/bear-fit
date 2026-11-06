import { routePartykitRequest } from "partyserver";

import { EditorPartyServer } from "./editor.partyserver";
import { serveIndex } from "./linkPreview";
import { OccupancyPartyServer } from "./occupancy.partyserver";

// routePartykitRequest needs an index-signature-compatible type, so not an interface.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Env = {
  ASSETS: Fetcher;
  main: DurableObjectNamespace<EditorPartyServer>;
  PUBLIC_KEY_B64: string;
  rooms: DurableObjectNamespace<OccupancyPartyServer>;
};

export { EditorPartyServer, OccupancyPartyServer };

/** `pnpm dev:prod` serves the app from localhost and talks to production. */
const CORS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Origin, X-Requested-With, Content-Type, Accept",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Only `/` runs the Worker first (`run_worker_first` in wrangler.toml).
    if (url.pathname === "/") return serveIndex(request, env, url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const response =
      (await routePartykitRequest(request, env, { prefix: "parties" })) ??
      new Response("Not Found", { status: 404 });

    if (response.webSocket) return response;

    const withCors = new Response(response.body, response);
    for (const [name, value] of Object.entries(CORS)) {
      withCors.headers.set(name, value);
    }
    return withCors;
  },
} satisfies ExportedHandler<Env>;
