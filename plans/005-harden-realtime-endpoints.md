# Plan 005: Harden the occupancy endpoint and dashboard auth (internal-only updates, replay-bounded signatures)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f6f3369..HEAD -- party/occupancy.partyserver.ts party/editor.partyserver.ts party/rooms.ts party/shared.ts app/dashboard/index.tsx .ssh/sign-message.tsx app/Dashboard.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f6f3369`, 2026-06-10

## Why this matters

Two verified holes, both modest in blast radius but cheap to close:

1. **The occupancy update endpoint is publicly writable.** `routePartykitRequest` (party/worker.ts:17) routes `POST /parties/rooms/index` straight to `OccupancyPartyServer.onRequest`, which accepts `{count, room}` from anyone. The endpoint exists only for internal DO-to-DO calls from `EditorPartyServer.updateOccupancyCount`. Anyone can wipe rooms (`count: 0`), inflate counts, or spam arbitrary room names into DO storage — corrupting the dashboard and growing storage without bound.
2. **Dashboard auth signatures replay forever.** The dashboard authorizes by ed25519-signing the constant string `"dashboard"` (`party/rooms.ts:8`, named `HARDCODED_AUTH_MESSAGE_NOT_SMART` — the author knows). A captured signature works for all time. What auth gates matters: the authorized payload is the full room map — i.e. **event IDs**, and an event ID is the only thing protecting an event (IDOR amplifier).

## Current state

- `party/worker.ts:15-23` — `routePartykitRequest(request, env, { prefix: "parties" })`; URL scheme `/parties/<binding>/<room>`; bindings: `main` (EditorPartyServer), `rooms` (OccupancyPartyServer). So `POST /parties/rooms/index` reaches `OccupancyPartyServer.onRequest` from the public internet.
- `party/occupancy.partyserver.ts`:
  - 76-102 (`onRequest`): `GET` → public aggregate `makePublicRoomInfo` (fine, keep public); `POST` → validates `{count, room}` with arktype `UpdateFromRoom`, mutates `this.rooms`, persists, broadcasts. **No auth.**
  - 51-74 (`onMessage`): `{type:"auth", payload:{signature}}` → `verifySignature(signature)` → `authorizeConnection`.
  - 139-154 (`verifySignature`): ed25519 `crypto.subtle.verify` over `textEncoder.encode(HARDCODED_AUTH_MESSAGE_NOT_SMART)`.
  - 156-162 (`authorizeConnection`): sends full `this.rooms` (room IDs = event IDs) and records expiry `Date.now() + AUTHORIZATION_EXPIRATION_TIME`.
- `party/rooms.ts:7-9`: `HARDCODED_AUTH_MESSAGE_NOT_SMART = "dashboard"`, `AUTHORIZATION_EXPIRATION_TIME = 1 day`, comment: "we could use a jwt with iat and exp, but this is fine for now".
- `party/editor.partyserver.ts:255-270` (`updateOccupancyCount`): `getServerByName(this.env.rooms, OCCUPANCY_SERVER_SINGLETON_ROOM_ID)` then `stub.fetch("https://occupancy.internal/update", { method: "POST", body: JSON.stringify({count, room: this.name}), ... })`. Note: this is a **DO stub fetch** — it does NOT pass through `party/worker.ts` routing; it invokes the DO's fetch handler directly, which in partyserver dispatches to `onRequest`. The URL hostname `occupancy.internal` is already a distinguishing marker available server-side only... but anyone can also send `Host: occupancy.internal`? No — public requests reach the DO only via `routePartykitRequest`, which rewrites to `/parties/rooms/index` paths on the public hostname. Verify this claim in Step 1 before relying on it; the robust fix is a shared-secret header regardless.
- `app/dashboard/index.tsx` — dashboard client; check how it obtains/sends the signature (it sends `{type:"auth", payload:{signature}}` over the partysocket). The operator generates a signature with `bun .ssh/sign-message.tsx` (signs the hardcoded message with the private key).
- `.ssh/sign-message.tsx` (730B) — bun script that signs a message with `.ssh/id_ed25519` (or test key). Read it before editing.
- `app/Dashboard.spec.ts` (86 lines) — e2e covering the auth flow using the committed TEST keypair (`.ssh/test/id_ed25519`); `playwright.config.ts:5-31` writes `PUBLIC_KEY_B64` (test pubkey) into `.dev.vars` for dev/CI. Prod uses a different key via `wrangler secret` (MIGRATION_NOTES.md).
- `party/shared.ts:3-8` — `CORS` headers with `Access-Control-Allow-Origin: "*"`, attached in `editor.partyserver.ts:106` only when `process.env.NODE_ENV !== "production"`. Leave as-is (worker builds set NODE_ENV at build time; verified low risk; documented in the index as accepted).
- Conventions: arktype for message schemas (`party/rooms.ts`), strict TS, e2e via Playwright with the test keypair.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| E2E (incl. Dashboard.spec) | `pnpm test` | all pass |
| Unit tests (if plan 001 landed) | `pnpm test:unit` | all pass |

## Scope

**In scope** (the only files you should modify/create):
- `party/occupancy.partyserver.ts`
- `party/editor.partyserver.ts` (updateOccupancyCount only)
- `party/rooms.ts` (auth message format + constants)
- `.ssh/sign-message.tsx` (sign timestamped message)
- `app/dashboard/index.tsx` (send timestamped auth payload)
- `app/Dashboard.spec.ts` (update + extend)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Auth on event rooms themselves (`/parties/main/*`) — anonymous-by-URL is the product model; CRDT-level write authorization is a rejected-for-now architecture change (see plans/README.md).
- The CORS dev-only block in `editor.partyserver.ts:104-110` / `party/shared.ts` — accepted risk, documented.
- Key rotation / the committed TEST keypair — documented as test-only in MIGRATION_NOTES.md; fine.
- Rate limiting (separate concern, plan 007 touches storage growth).

## Git workflow

- Branch: current working branch; do not commit to `main`.
- Commit style: imperative, e.g. `Require internal auth for occupancy updates`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Verify the publicly-reachable claim

Run the app locally if possible (`pnpm build && pnpm exec vite preview --port 1999` — this is what `pnpm test` does) and:

```sh
curl -s -X POST http://127.0.0.1:1999/parties/rooms/index \
  -H 'Content-Type: application/json' -d '{"count": 999, "room": "fake-room"}'
```

Expected today: `{"ok":true}` (the hole). Then `curl -s http://127.0.0.1:1999/parties/rooms/index` shows inflated `activeConnections`. If instead you get 401/404, the claim is stale — STOP and report.

### Step 2: Gate occupancy POST with a shared-secret header

Mechanism: the editor DO and occupancy DO live in the same Worker, so they can share an in-process secret — but Workers isolates restart, so derive it from config: add a constant header check using the existing secret material. Simplest robust option without new secrets: require header `x-occupancy-internal: 1` AND verify the request arrived via DO stub (not the public router) by checking `url.hostname === "occupancy.internal"` — public requests routed by `routePartykitRequest` carry the public URL. Implement BOTH checks:

In `party/editor.partyserver.ts` `updateOccupancyCount` (~line 262), add the header:

```ts
await stub.fetch("https://occupancy.internal/update", {
  body: JSON.stringify({ count, room: this.name }),
  headers: {
    "Content-Type": "application/json",
    "x-occupancy-internal": "1",
  },
  method: "POST",
});
```

In `party/occupancy.partyserver.ts` `onRequest` POST branch (line 81), before parsing the body:

```ts
const url = new URL(request.url);
if (
  url.hostname !== "occupancy.internal" ||
  request.headers.get("x-occupancy-internal") !== "1"
) {
  return Response.json({ error: "forbidden" }, { status: 403 });
}
```

(The hostname check is the real gate — `routePartykitRequest` preserves the public request URL; a client cannot make the DO see `occupancy.internal`. The header is belt-and-suspenders and self-documenting.)

**Verify**: rebuild + preview, re-run the Step 1 curl → `{"error":"forbidden"}` with status 403. Then run `pnpm test` → `app/Dashboard.spec.ts` still passes AND the occupancy counter still updates in specs that open events (Sync.spec.ts asserts room behavior — check it passes; if the internal call now fails, the hostname assumption is wrong → STOP).

### Step 3: Time-bound the dashboard auth message

Change the signed message from the constant `"dashboard"` to `"dashboard:<unix-ms-timestamp>"`:

- `party/rooms.ts`: replace line 7-8 with:

```ts
export const AUTH_MESSAGE_PREFIX = "dashboard:";
export const AUTH_MESSAGE_MAX_AGE = 1000 * 60 * 5; // signature valid 5 minutes
```

Update `ClientMessage` to `{ type: "'auth'", payload: { signature: "string", timestamp: "number" } }`.

- `party/occupancy.partyserver.ts` `onMessage` auth branch: check `Math.abs(Date.now() - parsed.payload.timestamp) <= AUTH_MESSAGE_MAX_AGE` (reject otherwise, before any crypto), then verify the signature over `textEncoder.encode(AUTH_MESSAGE_PREFIX + String(parsed.payload.timestamp))`. Keep `AUTHORIZATION_EXPIRATION_TIME` (the post-auth session window) as-is.
- `.ssh/sign-message.tsx`: sign `dashboard:${Date.now()}` and print BOTH the timestamp and signature (the dashboard needs to send the pair). Read the script's current output format and extend it minimally.
- `app/dashboard/index.tsx`: find where the auth message is sent (search `"auth"`); the UI takes a signature input — it must now also carry the timestamp. Simplest UX-preserving change: the sign script outputs a single token `"<timestamp>.<signatureB64>"`, the dashboard splits on the first `"."` and sends `{type:"auth", payload:{signature, timestamp: Number(ts)}}`. Implement that.
- `app/Dashboard.spec.ts`: it signs with the test key via `bun .ssh/sign-message.tsx` (check exactly how — read the spec); update to the new token format. Add a negative test: a token with a timestamp older than 5 minutes (sign one with `dashboard:<Date.now() - 6*60_000>` — extend sign-message.tsx to accept an optional timestamp argument for this) → dashboard does NOT receive the room list.

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` → Dashboard spec passes including the new stale-token test.

### Step 4: Lint + full suite

**Verify**: `pnpm lint` → exit 0; `pnpm test` → all green, both projects.

## Test plan

- Updated `app/Dashboard.spec.ts`: happy path with fresh token; stale-timestamp token rejected (the replay regression). Pattern: the spec's existing auth flow.
- Manual curl gate for the occupancy POST (Step 1/2) — document the result in the final report; optionally add a Playwright `request`-fixture test POSTing to `/parties/rooms/index` and asserting 403 (preferred if quick — put it in `app/Dashboard.spec.ts`).

## Done criteria

- [ ] `curl -X POST .../parties/rooms/index` (preview server) → 403
- [ ] `grep -n "HARDCODED_AUTH_MESSAGE_NOT_SMART" party/ app/ .ssh/ -r` → no matches
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0
- [ ] `pnpm test` exits 0, incl. updated Dashboard spec + stale-token negative test
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's curl does NOT succeed today (claim stale).
- After Step 2, the editor→occupancy internal call gets 403 (i.e. DO stub fetches do NOT preserve the `occupancy.internal` hostname in this partyserver version) — fall back to header-only is NOT acceptable alone; report so a real shared secret via env can be designed.
- `app/dashboard/index.tsx` auth flow differs structurally from the description (e.g. signature comes from a URL param, not an input).
- `bun` is unavailable in the test environment (Dashboard.spec.ts depends on it; CI installs it via oven-sh/setup-bun — local machines may not have it).

## Maintenance notes

- The 5-minute signature window vs 24h session window: operator signs a fresh token per login; sessions persist via `authorizedConnections` until disconnect/expiry. If the dashboard ever gets real multi-user auth, replace the whole scheme with signed JWTs (the `rooms.ts` comment already wanted that).
- Reviewer focus: the timestamp must be bound INTO the signed bytes (`dashboard:<ts>`), not sent alongside an unchanged signed constant — otherwise replay returns.
- The public GET aggregate (`makePublicRoomInfo`) intentionally stays public (rooms/connection counts only, no IDs).
