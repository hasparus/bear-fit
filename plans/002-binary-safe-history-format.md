# Plan 002: Make the event-history wire format binary-safe (length-prefixed framing)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f6f3369..HEAD -- party/editor.partyserver.ts app/ui/EventHistory/getUpdatesFromUint8Array.ts app/api/getHistory.ts app/ui/EventHistory/index.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-unit-test-baseline.md
- **Category**: bug
- **Planned at**: commit `f6f3369`, 2026-06-10

## Why this matters

The `/history` endpoint concatenates **binary Yjs updates** using the two-byte separator `\n\n` (0x0A 0x0A), and the client splits on every occurrence of those bytes. Yjs updates are arbitrary binary: any update whose payload happens to contain `0x0A 0x0A` (e.g. an event name containing `"\n\n"`, or coincidental varint bytes) mis-splits, after which clock labels and update payloads shift out of phase, `Y.applyUpdate` receives garbage, and the Version History dialog shows a corrupted document or an error — and "Restore" (creator-only) can then write that corrupted state back into the live event. The failure is data-dependent and intermittent, the worst kind. Length-prefixed framing removes the entire bug class.

## Current state

- `party/editor.partyserver.ts` — Durable Object (`EditorPartyServer extends YServer`) persisting Yjs docs to DO SQLite.
  - Lines 30-31: `const TEXT_ENCODER = new TextEncoder(); const HISTORY_SEPARATOR = TEXT_ENCODER.encode("\n\n");`
  - Lines 140-151 (`onRequest`): `GET /parties/main/${this.name}/history` → `this.encodeHistory(this.loadUpdates())` returned as `application/octet-stream`.
  - Lines 232-253 (`encodeHistory`): for each row, appends `String(row.clock)`, separator, update bytes, separator, then concatenates into one `Uint8Array`.
- `app/ui/EventHistory/getUpdatesFromUint8Array.ts` (27 lines, whole file is current state): scans for `body[i] === 10 && body[i+1] === 10`, slices into parts, then pairs them up as `{clock: decodedText, value: Uint8Array}`.
- `app/api/getHistory.ts` (6 lines): `fetch(`${serverUrl}/parties/main/${roomId}/history`)` → `res.arrayBuffer()`.
- `app/ui/EventHistory/index.tsx:135-149`: calls `getHistory(eventId)` then `getUpdatesFromUint8Array(new Uint8Array(updates))`, stores `{clock, value}[]` in state; lines 152-172 replay `updates[0..index].value` with `Y.applyUpdate` into a fresh `Y.Doc`.
- After plan 001 there is a characterization test `app/ui/EventHistory/getUpdatesFromUint8Array.test.ts` asserting the mis-split with a `// BUG ... fixed by plan 002` comment. This plan flips that assertion.
- Deployment note: client and server deploy **together** (one Worker serves both, `wrangler.toml` assets + DO). There is no version skew between deployed client and server, so the format can change atomically without content negotiation. In-flight old clients would break only during the deploy window — acceptable for this app.
- Conventions: strict TS, no new deps for this (hand-roll the framing — AGENTS.md says "DO NOT OVERENGINEER").

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Lint | `pnpm lint` | exit 0 |
| E2E (builds first) | `pnpm test` | all pass, incl. `app/EventHistory.spec.ts` |

## Scope

**In scope** (the only files you should modify/create):
- `party/editor.partyserver.ts` (encodeHistory only)
- `app/ui/EventHistory/getUpdatesFromUint8Array.ts` (rewrite decoder)
- `app/ui/EventHistory/getUpdatesFromUint8Array.test.ts` (update + extend)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- The SQLite storage schema (`documents`, `document_updates` tables) — this is wire format only; stored updates are already raw blobs and stay raw.
- `app/ui/EventHistory/index.tsx` — its contract (`{clock: string, value: Uint8Array}[]`) is preserved by the new decoder.
- Pagination/compaction of history (plan 007's territory).
- `app/api/getHistory.ts` — unchanged contract.

## Git workflow

- Branch: current working branch; do not commit to `main`.
- Commit style: imperative, e.g. `Use length-prefixed framing for event history payloads`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: New encoder on the server

In `party/editor.partyserver.ts`, replace `encodeHistory` (lines 232-253) with length-prefixed framing. Format per record: `[4-byte big-endian uint32: clock]` `[4-byte big-endian uint32: byteLength of update]` `[update bytes]`. Target shape:

```ts
private encodeHistory(rows: UpdateRow[]): Uint8Array {
  const totalSize = rows.reduce(
    (acc, row) => acc + 8 + new Uint8Array(row.update).byteLength,
    0,
  );
  const body = new Uint8Array(totalSize);
  const view = new DataView(body.buffer);
  let offset = 0;
  for (const row of rows) {
    const update = new Uint8Array(row.update);
    view.setUint32(offset, row.clock);
    view.setUint32(offset + 4, update.byteLength);
    body.set(update, offset + 8);
    offset += 8 + update.byteLength;
  }
  return body;
}
```

Delete the now-unused `HISTORY_SEPARATOR` constant (line 31) and, if `TEXT_ENCODER` (line 30) has no other use in the file, delete it too (grep the file first).

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 2: New decoder on the client

Rewrite `app/ui/EventHistory/getUpdatesFromUint8Array.ts` keeping the exact export name and return type (`{clock: string, value: Uint8Array}[]` — `clock` stays a string because `index.tsx:208` renders it directly):

```ts
export function getUpdatesFromUint8Array(body: Uint8Array) {
  const updates: { clock: string; value: Uint8Array }[] = [];
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let offset = 0;
  while (offset + 8 <= body.length) {
    const clock = view.getUint32(offset);
    const length = view.getUint32(offset + 4);
    if (offset + 8 + length > body.length) break; // truncated payload — stop cleanly
    updates.push({
      clock: String(clock),
      value: body.slice(offset + 8, offset + 8 + length),
    });
    offset += 8 + length;
  }
  return updates;
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Update the unit tests

In `getUpdatesFromUint8Array.test.ts` (created by plan 001):
- Replace the encode helper with one mirroring Step 1's framing.
- Round-trip test: two records, values `[1,2,3]` and `[10,10,10,10]` (the old killer payload) → decoded exactly. The `// BUG` characterization from plan 001 becomes a passing correctness test.
- Empty body → `[]`. Truncated body (cut the last record short) → returns only complete records, no throw.
- Clock fidelity: clock `4294967295` survives (uint32 max); record order preserved.

**Verify**: `pnpm test:unit` → all pass.

### Step 4: End-to-end confirmation

`app/EventHistory.spec.ts` already drives the Version History dialog through the real server. Run it.

**Verify**: `pnpm test` → all pass. Specifically confirm the EventHistory spec passes on both projects (chromium, firefox).

## Test plan

- Updated `app/ui/EventHistory/getUpdatesFromUint8Array.test.ts`: round-trip with `\n\n`-containing binary values (the regression this plan exists for), empty, truncated, uint32-max clock, ordering. Model after the file's existing structure from plan 001.
- Existing e2e `app/EventHistory.spec.ts` acts as the integration gate (history fetch, slider, restore).

## Done criteria

- [ ] `grep -n "HISTORY_SEPARATOR" party/editor.partyserver.ts` → no matches
- [ ] `grep -n "=== 10" app/ui/EventHistory/getUpdatesFromUint8Array.ts` → no matches (no byte-scanning left)
- [ ] `pnpm test:unit` exits 0, incl. a test whose update payload contains consecutive `0x0A` bytes
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0
- [ ] `pnpm test` exits 0 (EventHistory e2e green)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `row.update` in `encodeHistory` is not reliably coercible to `Uint8Array` (check `loadUpdates`, `party/editor.partyserver.ts:194-216`, which already normalizes ArrayBuffer/ArrayBufferView) — if you find a third shape, report it.
- `app/ui/EventHistory/index.tsx` turns out to depend on the textual `clock` in a way `String(uint32)` breaks (e.g. it ever contained a state-vector marker `"sv"` — search the repo for `"sv"` handling before assuming).
- `pnpm test` fails in EventHistory restore for reasons unrelated to parsing (pre-existing flake — the spec uses `waitForTimeout`; retry once, then report).
- You're tempted to add a format-version byte or content negotiation — don't; client and server deploy atomically here. Report if you find evidence to the contrary (e.g. a separately-deployed client).

## Maintenance notes

- Plan 007 (history compaction / TTL) builds on this format; if it introduces snapshots, extend the framing with a record-type byte THEN, not now.
- Reviewer focus: off-by-one in offset arithmetic, and that `body.slice` (copy) — not `subarray` (view) — is used, since `Y.applyUpdate` may retain the buffer.
- Old deployed clients during the deploy window will fail to parse new payloads (and vice versa). Deploy client+worker together as usual (`pnpm release` does).
