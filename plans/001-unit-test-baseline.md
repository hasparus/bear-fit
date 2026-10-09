# Plan 001: Establish a vitest unit-test baseline for pure date/schema/parsing logic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f6f3369..HEAD -- app/schemas.ts app/ui/eachDayOfInterval.tsx app/ui/getPaddingDays.tsx app/ui/dateRangeValidation.ts app/ui/EventHistory/getUpdatesFromUint8Array.ts package.json tsconfig.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `f6f3369`, 2026-06-10

## Why this matters

The only test layer today is Playwright e2e (`pnpm test` = full Vite build + browser suite, ~minutes per run). All date math, schema validation, and binary history parsing are pure functions that are only exercised incidentally through the browser — timezone edge cases and buffer-boundary bugs can't be tested that way at all (e2e runs in the developer's timezone). Plans 002 (history wire format) and 003 (timezone fixes) need fast unit tests as their safety net, so this plan must land first. `vitest` is already in devDependencies but has no config and zero tests; its current version (`^3.0.9`) also carries a known critical advisory fixed in 3.2.6+, so this plan bumps it while wiring it up.

## Current state

- `package.json` — scripts: `"test": "pnpm build && playwright test"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint app party"`. devDependencies include `"vitest": "^3.0.9"`. There is **no** `vitest.config.ts` anywhere and no `*.test.ts` files — confirm with `ls vitest.config.* 2>/dev/null` (no match) and `find app party -name "*.test.ts"` (no match).
- `app/*.spec.ts` files are **Playwright e2e specs**, NOT unit tests. `playwright.config.ts` has `testDir: "./app"` and picks up `*.spec.ts`. Unit tests must use the `.test.ts` suffix so the two runners never collide.
- `app/schemas.ts` — pure date/schema logic. Key excerpts (verify these exist):
  - `app/schemas.ts:14-15`: `export const isoDate = (date: Date): IsoDate => date.toISOString().split("T")[0] as IsoDate;`
  - `app/schemas.ts:20-25`: `startOfTodayUtc()` builds a UTC-midnight Date.
  - `app/schemas.ts:30-31`: `diffDays(later, earlier)` = `(utcDay(later) - utcDay(earlier)) / 86_400_000`.
  - `app/schemas.ts:33-40`: `addDays(date, days)` via `Date.UTC(...)`.
  - `app/schemas.ts:42-48`: `resolveRollingWindow(days, today = startOfTodayUtc())` returns `{ startDate: isoDate(today), endDate: isoDate(addDays(today, days)) }`.
  - `app/schemas.ts:50-72`: `CalendarEvent` arktype with a `.narrow` enforcing "rolling XOR (startDate && endDate)".
  - `app/schemas.ts:101-135`: `AvailabilityKey(userId, date)` joins with separator `"〷"`; `AvailabilityKey.parse` / `AvailabilityKey.parseToObject` validate only the date part and throw `Invalid AvailabilityKey with IsoDate: ...` on bad dates.
- `app/ui/eachDayOfInterval.tsx` — 8 lines; steps by `86400000` ms from `from` to `to` inclusive.
- `app/ui/getPaddingDays.tsx` — `(firstDay.getDay() - weekStartsOn + 7) % 7` (note: **local** `getDay()`; plan 003 changes this to UTC — write the tests against current behavior using UTC-midnight inputs in a UTC test environment so they keep passing after plan 003).
- `app/ui/dateRangeValidation.ts:4` — `return !!(dateRange.from && dateRange.to && dateRange.from < dateRange.to)` (strict `<`: a single-day range is currently invalid — characterize that as-is, do not "fix" it).
- `app/ui/EventHistory/getUpdatesFromUint8Array.ts` — splits a `Uint8Array` on consecutive `10, 10` bytes (`\n\n`) into `{clock, value}` pairs. KNOWN LIMITATION: binary Yjs updates may legitimately contain `0x0A 0x0A`, which mis-splits — plan 002 fixes the format. Here, only characterize current behavior with payloads that avoid `\n\n` inside values.
- `tsconfig.json` — `"include": ["party", "app", "env.d.ts"]`; new `.test.ts` files inside `app/` are covered automatically.
- `app/types.d.ts:1` contains `/// <reference types="@vitest/browser/providers/playwright" />` — leftover; removing it is in scope if typecheck passes without it.
- Repo conventions: TypeScript strict, ESLint with `eslint-plugin-perfectionist` (auto-sorts imports — run `pnpm lint --fix` rather than hand-ordering), Prettier (`pnpm format`). AGENTS.md: "DO NOT OVERENGINEER. WE WANT MINIMAL, SURGICAL WORK."

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0, no output |
| Unit tests (new) | `pnpm test:unit` | all pass |
| Lint | `pnpm lint` | exit 0 |
| E2E (unchanged, slow — run once at the end) | `pnpm test` | all pass |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (add `test:unit` script; bump `vitest` to `^3.2.6` or later 3.x)
- `pnpm-lock.yaml` (via `pnpm install` only)
- `vitest.config.ts` (create)
- `app/schemas.test.ts` (create)
- `app/ui/dateUtils.test.ts` (create — covers eachDayOfInterval, getPaddingDays, dateRangeValidation)
- `app/ui/EventHistory/getUpdatesFromUint8Array.test.ts` (create)
- `app/types.d.ts` (remove the `@vitest/browser` reference line only)
- `.github/workflows/ci.yml` (add a unit-test step)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any source behavior change — this plan adds tests only. If a test reveals a bug, characterize the current behavior with a `// BUG:` comment and report it; do not fix.
- `playwright.config.ts`, `test/index.ts`, any `*.spec.ts` file.
- Coverage wiring (nyc/lcov) — unit coverage integration is a follow-up.

## Git workflow

- Branch: work on the current branch unless instructed otherwise (repo is mid-feature-branch flow; do not commit to `main`).
- Commit style: imperative mood, e.g. `Add vitest unit-test baseline for date and schema logic` (matches `git log` style like "Key per-test coverage files so nyc merges the union").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Bump vitest and add config + script

In `package.json`: change `"vitest": "^3.0.9"` to the latest 3.x (`pnpm add -D vitest@^3` is acceptable), and add script `"test:unit": "vitest run"`. Create `vitest.config.ts` at repo root:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/**/*.test.ts", "party/**/*.test.ts"],
    environment: "node",
  },
});
```

Node environment is enough — every target function is pure. Run `pnpm install`.

**Verify**: `pnpm test:unit` → "No test files found" error is expected at this point (exit non-zero); `pnpm typecheck` → exit 0.

### Step 2: Tests for app/schemas.ts

Create `app/schemas.test.ts` importing from `./schemas`. Cases (use explicit `new Date(Date.UTC(...))` constructions so the suite is timezone-independent):

- `isoDate(new Date(Date.UTC(2026, 0, 31)))` → `"2026-01-31"`.
- `IsoDate("2026-02-30")` → instance of `type.errors` (import `{ type }` from `"arktype"`); `IsoDate("2026-02-28")` → the string back. Note: check `instanceof type.errors`, matching usage at `app/schemas.ts:115`.
- `diffDays`: same instant → 0; consecutive UTC days → 1; across a DST change in some local zone (e.g. 2026-03-08 → 2026-03-09) → 1 (UTC math is immune).
- `addDays`: month rollover (`2026-01-31` + 1 → `2026-02-01`), year rollover, negative days.
- `resolveRollingWindow(7, new Date(Date.UTC(2026, 5, 10)))` → `{ startDate: "2026-06-10", endDate: "2026-06-17" }`.
- `resolveEventDates`: rolling event ignores any start/end and derives from `today`; fixed event passes through.
- `CalendarEvent.assert`: accepts `{id, creator, name, startDate, endDate}`; accepts `{id, creator, name, rolling: 3}`; rejects rolling+startDate; rejects neither; rejects `rolling: 0` and `rolling: 1.5`. (Build `creator` with `UserId.assert("u1")`.)
- `AvailabilityKey("u1" as UserId, "2026-06-10" as IsoDate)` → `"u1〷2026-06-10"`; `parseToObject` round-trips; `parse` throws on `"u1〷not-a-date"`. Characterize the known gap with a comment: the userId half is **not** validated (`AvailabilityKey.parse("〷2026-06-10")` does not throw — assert that, with `// BUG: userId part unvalidated`).

**Verify**: `pnpm test:unit` → all tests in `app/schemas.test.ts` pass.

### Step 3: Tests for the date UI utilities

Create `app/ui/dateUtils.test.ts`:

- `eachDayOfInterval(utc(2026,5,1), utc(2026,5,3))` → 3 dates, inclusive ends. Empty when `from > to`. 90-day span → 90+1 dates (AGENTS-adjacent TODO mentions 3-month events).
- `getPaddingDays`: for a UTC-midnight Monday with `weekStartsOn: 1` → expected offset given **local** `getDay()` — run these cases with dates whose local/UTC day agree by setting `TZ=UTC` for the unit suite. Add `env: { TZ: "UTC" }`? Vitest doesn't set TZ; instead set it in `vitest.config.ts` via `test: { env: { TZ: "UTC" } }`. Add that to the config in Step 1 (it is honored on Node ≥ 16 for new Date calls in the worker).
- `isValidDateRange`: valid when `from < to`; false for `from === to` (`// current behavior: single-day ranges rejected`); false when either side missing; false for inverted.

**Verify**: `pnpm test:unit` → passes. Then re-run with a non-UTC zone to prove the suite is hermetic: `TZ=America/New_York pnpm test:unit` → passes (if this fails, the test relies on ambient TZ — fix the test, not the source).

### Step 4: Tests for getUpdatesFromUint8Array

Create `app/ui/EventHistory/getUpdatesFromUint8Array.test.ts`:

- Encode helper mirroring the server (`party/editor.partyserver.ts:232-253`): parts joined as `label \n\n value \n\n`. Build `"1" \n\n [0x01,0x02] \n\n "2" \n\n [0x03] \n\n` and assert two `{clock, value}` pairs with correct bytes.
- Empty input → `[]`.
- Trailing-separator handling: the server appends a final `\n\n`, so the decoder receives a body ending in `10,10` — assert current behavior (characterize whatever it returns; do not "fix").
- Add the known-limitation characterization: a value containing `[10, 10]` mis-splits — assert the (wrong) current output with `// BUG: binary values containing \n\n are split; fixed by plan 002`.

**Verify**: `pnpm test:unit` → passes.

### Step 5: Wire into CI and clean up the stray reference

Remove line 1 (`/// <reference types="@vitest/browser/providers/playwright" />`) from `app/types.d.ts`. In `.github/workflows/ci.yml`, add a step `run: pnpm test:unit` after the install/typecheck steps (read the file first and mirror its existing step style).

**Verify**: `pnpm typecheck` → exit 0. `pnpm lint` → exit 0. `pnpm test:unit` → all pass.

### Step 6: Full-suite sanity

**Verify**: `pnpm test` → Playwright suite passes exactly as before (no spec collisions — Playwright must not pick up `*.test.ts`; if it does, STOP: the glob assumptions changed).

## Test plan

This plan IS the test plan: ~40 new assertions across 3 new test files (`app/schemas.test.ts`, `app/ui/dateUtils.test.ts`, `app/ui/EventHistory/getUpdatesFromUint8Array.test.ts`). Structural pattern: plain vitest `describe`/`it` (no existing unit tests exist to model after — keep it boring).

## Done criteria

- [ ] `pnpm test:unit` exits 0 with ≥ 30 passing tests
- [ ] `TZ=America/New_York pnpm test:unit` exits 0 (hermetic w.r.t. timezone)
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` (e2e) exits 0
- [ ] `grep -c "vitest" package.json` ≥ 2 (dep + script) and installed vitest version ≥ 3.2.6 (`pnpm why vitest`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `*.test.ts` files get picked up by Playwright (`pnpm test` reports them) — the suffix-separation assumption is wrong.
- Bumping vitest pulls in a peer-dependency conflict with `@playwright/test` or the pnpm `overrides` pinning `playwright 1.60.0`.
- Any characterization test reveals behavior so broken that asserting it feels wrong (e.g. `eachDayOfInterval` returning duplicates) — report the finding instead of fixing source.
- `TZ=...` runs flake — the TZ env approach isn't honored in this Node version.

## Maintenance notes

- Plans 002 and 003 will UPDATE the characterization tests written here (the `// BUG:` assertions flip to correct expectations). Reviewers should expect those tests to change again soon.
- If `getPaddingDays`/`eachDayOfInterval` move to a consolidated `app/utils/date.ts` later (debt finding DEBT-14), move the tests alongside.
- Unit coverage is NOT merged into the 65% lcov CI gate; that remains e2e-only. Follow-up if desired.
