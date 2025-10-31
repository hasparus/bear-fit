## PartyServer Fixture Insights

- **Hono integration** shows the mix of HTTP routes and PartyServer rooms by
  registering `partyserverMiddleware` alongside regular handlers; reference:
  `outside/partykit/fixtures/hono/src/server.ts`.
- **Vite dev workflow** consistently hooks in `@cloudflare/vite-plugin` so
  `vite dev` runs the Worker/Durable Objects locally (e.g.
  `outside/partykit/fixtures/hono/vite.config.ts`), confirming we can replace
  `partykit dev` with the plugin-driven dev server.
- **Yjs rooms** (`lexical-yjs`, `tiptap-yjs`) expose Workers as thin
  `routePartykitRequest` wrappers with Durable Object bindings in
  `wrangler.toml`, and clients call `useYProvider` with prefixes that encode the
  DO namespace, mirroring paths like `/parties/lexical-document/{doc}`.
- **Persistence hooks** in `tiptap-yjs` highlight how `YServer` uses
  `onStart`/`onLoad`/`onSave` plus `ctx.storage.sql` to back documents with
  SQLite and debounce updates (`static callbackOptions`).
- **Non-Yjs rooms** such as `tldraw` extend the base `Server`, keep
  authoritative state in memory, broadcast updates, and throttle
  `ctx.storage.put` writes—good template for our occupancy dashboard Durable
  Object.
- **Pub/Sub fixture** demonstrates composing PartyServer with sibling packages
  (`partysub`) while still routing through a default export that delegates HTTP
  to the package’s router.
