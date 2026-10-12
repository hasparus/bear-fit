import { routePartykitRequest } from "partyserver";

import { EditorPartyServer } from "./editor.partyserver";
import { OccupancyPartyServer } from "./occupancy.partyserver";

// routePartykitRequest needs an index-signature-compatible type, so not an interface.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Env = {
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
