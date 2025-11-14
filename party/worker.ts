import { routePartykitRequest } from "partyserver";

import { EditorPartyServer } from "./editor.partyserver";
import { OccupancyPartyServer } from "./occupancy.partyserver";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Env = {
  main: DurableObjectNamespace<EditorPartyServer>;
  rooms: DurableObjectNamespace<OccupancyPartyServer>;
  PUBLIC_KEY_B64: string;
};

export { EditorPartyServer, OccupancyPartyServer };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await routePartykitRequest(request, env, {
      prefix: "parties",
    });

    return response ?? new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
