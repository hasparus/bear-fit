import { routePartykitRequest } from "partyserver";

import { EditorPartyServer } from "./editor.partyserver";
import { OccupancyPartyServer } from "./occupancy.partyserver";

type Env = {
  EditorPartyServer: DurableObjectNamespace<typeof EditorPartyServer>;
  OccupancyPartyServer: DurableObjectNamespace<typeof OccupancyPartyServer>;
};

export { EditorPartyServer, OccupancyPartyServer };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await routePartykitRequest(request, env, {
      prefix: "parties"
    });

    return response ?? new Response("Not Found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
