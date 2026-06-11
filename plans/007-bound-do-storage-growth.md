# Plan 007: Bound Durable Object storage — event TTL via alarms + update-log compaction

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f6f3369..HEAD -- party/editor.partyserver.ts party/occupancy.partyserver.ts wrangler.toml`
> If `party/editor.partyserver.ts` changed since this plan was written (plan 002
> legitimately rewrites `encodeHistory`), compare the "Current state" excerpts
> against the live code before proceeding; on a structural mismatch, treat it
> as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/002-binary-safe-history-format.md (history framing; compaction changes what history returns)
- **Category**: tech-debt / security (resource exhaustion)
- **Planned at**: commit `f6f3369`, 2026-06-10

## Why this matters

Every event ever created lives forever: `EditorPartyServer` persists the full doc in `documents` AND appends **every Yjs update** to `document_updates` with no pruning, TTL, or size cap (`party/editor.partyserver.ts:165-181, 218-230`). The `/history` endpoint ships the entire log to any client that asks. Three costs: (1) unbounded paid DO storage for a product whose events are intrinsically transient ("find a date next month"); (2) anyone can flood a room with CRDT updates and grow storage without limit — the cheapest DoS in the codebase; (3) the history payload grows linearly forever, making the Version History dialog slower every week. A TTL via DO alarms plus a per-room update cap bounds all three.

## Current state

- `party/editor.partyserver.ts` (all line numbers at `f6f3369`):
  - 27-28: `TABLE_DOCUMENTS = "documents"`, `TABLE_UPDATES = "document_updates"`.
  - 50-62 (`onStart`): `ensureTables()`, load `#lastClock`, subscribe `document.on("update", ...)` → `persistIncrementalUpdate`.
  - 64-75 (`onLoad`): loads `state` blob for `this.name`, `Y.applyUpdate`.
  - 77-84 (`onSave`): `INSERT OR REPLACE` full state snapshot. Called by YServer's debounced callback (`callbackOptions`, lines 34-38) and explicitly after event creation (line 128).
  - 165-181 (`ensureTables`): two `CREATE TABLE IF NOT EXISTS` statements, no TTL columns.
  - 218-230 (`persistIncrementalUpdate`): unconditional INSERT, `#lastClock += 1`.
  - 140-151: `/history` GET returns every update row.
- DO alarms: `partyserver`'s `Server` exposes the standard Durable Object `alarm()` handler via the platform; verify how `YServer`/`Server` surface it — grep `node_modules/partyserver/dist` for `alarm` (read-only) to confirm whether overriding `alarm()` on the class Just Works or whether partyserver reserves it. **This is Step 1; the design assumes a plain `alarm()` override is available.**
- `wrangler.toml` — `new_sqlite_classes = ["EditorPartyServer", "OccupancyPartyServer"]`; SQLite-backed DOs support `ctx.storage.setAlarm` / `deleteAll`.
- Product context for choosing the TTL: events are share-by-URL, no accounts. `app/AppFooter.tsx` keeps "recent events" in localStorage — links die when the event expires. Default chosen: **expire an event 60 days after its last write** (sliding window), far beyond any scheduling horizon observed in the repo (rolling windows are ≤ small N days; todo.gitignored.md mentions testing 3-month events → 60 days after *last write* still covers them since participants keep writing).
- Cap chosen: **5,000 updates per room**; beyond that, compact: fold the update log into the current state snapshot and delete the log (history dialog then shows a single "compacted" baseline + subsequent updates). 5k is ~2 orders of magnitude above what the e2e suite generates per room; verify with a count query while running the suite if uncertain.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| E2E | `pnpm test` | all pass |

## Scope

**In scope** (the only files you should modify/create):
- `party/editor.partyserver.ts`
- `party/editor.expiry.test.ts` (create — pure-logic tests only; DO runtime not unit-testable here)
- `app/EventHistory.spec.ts` (only if compaction visibly changes history UX — see Step 4)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- A "delete event" button / creator-facing UI — product feature, separate.
- `OccupancyPartyServer` storage (single small JSON blob — already bounded-ish; its public-POST hardening is plan 005).
- Rate limiting per connection — different mechanism, separate decision.
- Changing the history wire format (plan 002 owns it).

## Git workflow

- Branch: current working branch; do not commit to `main`.
- Commit style: imperative, e.g. `Expire idle event rooms with DO alarms`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm alarm support in partyserver

Read `node_modules/partyserver/dist/index.js` (or `.d.ts`) for `alarm`. Expected: partyserver does not define `alarm`, so a plain `async alarm()` method on `EditorPartyServer` receives the platform callback. If partyserver DOES wrap alarms (e.g. uses them internally for hibernation), STOP and report the mechanism it exposes.

**Verify**: report the grep result in the work log; `pnpm typecheck` on a stub `async alarm(): Promise<void> {}` → exit 0.

### Step 2: Sliding-window TTL

In `party/editor.partyserver.ts`:

- Add constants near the table names: `const EVENT_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days idle`.
- Add a private `touch()` that schedules expiry: `void this.ctx.storage.setAlarm(Date.now() + EVENT_TTL_MS);` — call it from `persistIncrementalUpdate` (every write slides the window) and from the POST-create branch in `onRequest` (line ~127). `setAlarm` overwrites any pending alarm — that's the sliding behavior, no bookkeeping needed.
- Implement the handler:

```ts
async alarm(): Promise<void> {
  // 60 days with no writes: drop everything for this room.
  await this.ctx.storage.deleteAll();
}
```

`deleteAll()` on a SQLite DO clears tables and alarm state; the DO is then evicted and the room id becomes a fresh empty room if ever revisited (the UI already handles "no event in room" — the create form path; verify by visiting a random `?id=` in Step 5).

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 3: Compaction cap on the update log

In `persistIncrementalUpdate`, after the INSERT, when `this.#lastClock % 256 === 0` (cheap periodic check) count rows for this room; if count > 5,000, compact:

```ts
private compactUpdates() {
  // Fold the log into the snapshot; history restarts from a compacted baseline.
  const state = Y.encodeStateAsUpdate(this.document);
  this.ctx.storage.sql.exec(
    `INSERT OR REPLACE INTO ${TABLE_DOCUMENTS} (id, state) VALUES (?, ?)`,
    this.name,
    state,
  );
  this.ctx.storage.sql.exec(
    `DELETE FROM ${TABLE_UPDATES} WHERE doc_id = ?`,
    this.name,
  );
  this.ctx.storage.sql.exec(
    `INSERT INTO ${TABLE_UPDATES} (doc_id, clock, update_data) VALUES (?, ?, ?)`,
    this.name,
    this.#lastClock + 1,
    state,
  );
  this.#lastClock += 1;
}
```

The final INSERT seeds the log with the compacted state so `/history` still replays to the current doc (one baseline record). Wrap the three statements in `this.ctx.storage.transactionSync(() => { ... })` if available on the SQLite storage API (check `@cloudflare/workers-types` for `transactionSync`; if absent, sequential exec is acceptable — DOs are single-threaded).

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Tests

- `party/editor.expiry.test.ts` (vitest, node env — plan 001's config picks up `party/**/*.test.ts`): the class itself needs the DO runtime, so test the extractable pure parts — if Step 3's row-count/threshold logic is written as a pure helper (`shouldCompact(count: number): boolean`, `EVENT_TTL_MS` exported), assert the constants and threshold edges. Keep it honest: these are smoke-level tests; the real gate is e2e.
- e2e: run `app/EventHistory.spec.ts` — compaction must NOT trigger during the suite (5k threshold); history behavior unchanged.

**Verify**: `pnpm test:unit` → pass; `pnpm test` → all pass.

### Step 5: Manual expiry sanity (preview server)

With `pnpm exec vite preview --port 1999` running: create an event, then via curl confirm `/parties/main/<id>` returns the event JSON. (Alarms can't be fast-forwarded in preview; the alarm path is verified by code review + the typecheck — note this gap explicitly in your report.) Visit `http://127.0.0.1:1999/?id=nonexistent-room-xyz` → app shows the create/empty state, not a crash (this is the post-expiry UX).

**Verify**: both observations recorded in the report.

## Test plan

- Unit: threshold/constant tests in `party/editor.expiry.test.ts` (pattern: plain vitest like plan 001's files).
- E2E: existing `EventHistory.spec.ts` + `App.spec.ts` unchanged and green (proves no behavior change below the cap).
- Documented manual gap: alarm firing is not exercised pre-deploy; reviewer must check `alarm()`/`touch()` wiring by reading.

## Done criteria

- [ ] `grep -n "setAlarm" party/editor.partyserver.ts` ≥ 1 match; `grep -n "async alarm" party/editor.partyserver.ts` → 1 match
- [ ] `grep -n "5_000\|5000" party/editor.partyserver.ts` → compaction threshold present
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test` all exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds partyserver/YServer already uses DO alarms internally (hibernation, callbacks) — overriding would break sync; report what it exposes instead.
- `ctx.storage.deleteAll()` is not available or behaves differently on SQLite-backed DOs in the installed `@cloudflare/workers-types` — check the types before assuming.
- Compaction interacts badly with plan 002's framing (e.g. clock reset expectations in the client slider) — coordinate; the seeded baseline record approach should hold, but if `EventHistory` UI assumes clock starts at 1, report.
- You're tempted to also add per-connection rate limiting — out of scope; report the idea instead.

## Maintenance notes

- TTL = 60 days idle and cap = 5,000 updates are policy knobs, not architecture — revisit when real usage data exists (occupancy dashboard shows live rooms).
- If a creator-facing "delete event" lands later, it should call the same `deleteAll()` path.
- The expiry silently invalidates shared links and footer "recents" — if users complain, the next iteration is a tombstone record ("this event expired") instead of a clean empty room.
- Reviewer focus: alarm scheduling must not run on every keystroke-level update in a hot path synchronously — `setAlarm` is async/cheap, `void`-ing it is fine, but confirm no `await` was added inside the Yjs `update` handler (it must stay synchronous).

---

## Revision 2 (2026-06-11) — supersedes Steps 2's deleteAll and adds a UX surface

Maintainer decision: **never let a user join an empty room, and never silently
destroy an expired event** — expired events are sometimes important. The TTL
bounds the unbounded part (the update log), not the event itself.

Changes vs the original design:

1. **`onAlarm`**: if the room has a calendar event → compact to a final state
   snapshot in `documents`, delete all `document_updates` rows, and store an
   `expiredAt` (ms) marker via `ctx.storage.put`. Only rooms with NO event
   (junk from typo'd links) get `deleteAll()`.
2. **`onConnect`** (EditorPartyServer): before starting sync, close the
   connection with app code `4404` when the room has no event, and `4410` when
   `expiredAt` is set. Legit clients always connect after the create POST
   succeeded, so live flows are unaffected.
3. **GET `/parties/main/:id`** additionally returns `expiredAt` (number | null)
   alongside the doc JSON so the client can distinguish live / expired / absent.
4. **Client**: `Routes` preflights that GET before mounting `YProvider`:
   - no event → "event not found" retro box (no WS connection, nothing persisted);
   - `expiredAt` set → hydrate the local doc from the JSON
     (`overwriteYDocWithJson`) and render `<EventDetails disabled />` behind an
     "expired on <date>" banner — Export JSON in the footer still works;
   - live → current behavior.
5. **Integration note**: PR #31's `Dashboard.spec.ts` seeds occupancy by opening
   raw WebSockets to event-less rooms; once both land, that helper must create
   real events first (the rejection in (2) closes its sockets).
