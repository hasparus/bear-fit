## Migration Decisions (PartyKit -> Cloudflare Workers + PartyServer)

- **Client build**: the app is built by Vite as a multi-page app. `index.html`
  and `dashboard.html` now live at the project root and load `app/client.tsx`
  and `app/dashboard/index.tsx` as module scripts. `public/` holds static assets
  only (the stale partykit `public/dist/*` bundles and `public/*.html` were
  removed). The second page is registered via `environments.client.build
  .rollupOptions.input` so it stays out of the Worker build.
- **Globals**: `APP_VERSION` and `import.meta.env.ALWAYS_PROD` are injected via
  Vite `define` (replacing partykit.json's `define`). `PARTYKIT_HOST` was deleted
  and the dashboard now uses the same `serverUrl` derivation as the app.
- **Prod origin**: the worker serves the app and `/parties/*` from the same
  origin, so `serverUrl` defaults to same-origin. `dev:prod` can target a
  deployed origin by setting `PROD_SERVER_URL` (injected via `define`).
- **Secrets**: `PUBLIC_KEY_B64` is a `wrangler secret` in prod and comes from a
  `.dev.vars` file in dev/CI (written by `playwright.config.ts`). The committed
  `.ssh/test/id_ed25519` keypair is TEST-ONLY; production must use a different
  key so the committed key can never authorize a real deployment.
- **Deploy**: `scripts/deploy.sh` runs `vite build` then `wrangler deploy`
  (main) or `wrangler versions upload` (preview). CI uses `CLOUDFLARE_API_TOKEN`.
- **SQLite DO**: migration uses `new_sqlite_classes` because `EditorPartyServer`
  (YServer) persists via `ctx.storage.sql`.
- **Behavior change**: occupancy now deletes a room entry when its count reaches
  0 (old server kept 0-count rooms). This keeps `makePublicRoomInfo`'s room
  count to live rooms only and lets the dashboard clean up.

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
