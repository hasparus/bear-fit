# Plan 003: Make calendar rendering and edit-form date math UTC-consistent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f6f3369..HEAD -- app/ui/EventDetails.tsx app/ui/EditEventForm.tsx app/ui/getPaddingDays.tsx app/ui/eachDayOfInterval.tsx app/schemas.ts app/ui/EventDatesPicker.tsx`
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

Event dates are stored as date-only ISO strings (`"2026-07-01"`). `new Date("2026-07-01")` parses as **UTC midnight**, but the grid then reads it with **local-time** getters. For any user west of UTC (all of the Americas), UTC midnight is the previous local day, so: the month grouping key is computed from the previous day (a July 1 event renders under a "June" header), weekday padding is off by one column (days land under the wrong weekday name), and displayed start/end dates render one day early. Users east of UTC never see it — which is why the (UTC+2-based) author hasn't. The fix is mechanical: every read of a date that was constructed from an ISO date string must use UTC getters/formatters.

## Current state

All line numbers at commit `f6f3369`.

- `app/schemas.ts` — already has the correct UTC toolkit: `isoDate(date)` (`toISOString().split("T")[0]`, line 14), `startOfTodayUtc()` (20-25), `utcDay`, `diffDays`, `addDays` (27-40). Dates stored in Yjs are `IsoDate` strings. **The storage layer is fine; only presentation/form code mixes zones.**
- `app/ui/EventDetails.tsx`:
  - Line 74: `const { endDate, startDate } = resolveEventDates(event);` → ISO strings.
  - Lines 128-141: `groupedDays` — `eachDayOfInterval(new Date(startDate), new Date(endDate)).reduce(...)` with `const monthKey = `${day.getFullYear()}-${day.getMonth()}`;` ← **local getters on UTC-midnight dates (bug)**.
  - Line 279/283: `{new Date(startDate).toLocaleDateString()}` / same for `endDate` ← **local rendering of UTC-midnight (bug: shows previous day west of UTC)**.
  - Line 354: `monthDays[0].toLocaleDateString("en-US", { month: "long", ... })` (verify exact options in file) ← **local month name (bug at month boundaries)**.
  - Line 387: `const dateStr = isoDate(day);` ← correct (UTC); availability keys are consistent. Do not touch key derivation.
  - Grid cells also render the day-of-month — find the JSX near line 387-430 that renders the visible day number (look for `.getDate()` or similar) and include it in the UTC sweep.
- `app/ui/getPaddingDays.tsx` (whole file): `const day = firstDay.getDay();` ← **local (bug)**; must become `getUTCDay()`.
- `app/ui/EditEventForm.tsx`:
  - Lines 22-24: `seedStart = new Date(startDate)` (UTC midnight), `seedEnd = new Date(endDate)`.
  - Lines 33-34: `const today = new Date(); const earliestDate = seedStart && seedStart < today ? seedStart : today;` ← compares UTC-midnight against local "now" and hands a time-of-day-bearing `today` to react-day-picker `disabled: { before: earliestDate }` (line 56). Should be `startOfTodayUtc()`… **but see the react-day-picker caveat below**.
  - Lines 76-88: `unfoldDateRange` iterates with `date.setDate(date.getDate() + 1)` ← local stepping over UTC-midnight seeds; across a DST transition this can drift by an hour and (in zones with midnight DST shifts) skip/duplicate a modifier date. Use `addDays` from `app/schemas.ts`.
- `app/ui/eachDayOfInterval.tsx` (whole file): steps by `86400000` ms — given UTC-midnight inputs this is exactly correct; no change needed (it only breaks if fed local-midnight dates — don't).
- **react-day-picker caveat (read before editing)**: `EventDatesPicker`/`DateRangePicker` (react-day-picker v9) operate on **local** dates — the user picks "July 1" in their local calendar. The boundary rule must be: dates flowing **out of storage into the picker** get converted UTC→"local date with same Y/M/D", and picker output gets converted back local→`IsoDate` via its Y/M/D fields, NOT via `toISOString()` (which would shift the day for east-of-UTC users at the other end). Check how `EventDatesPicker`'s `eventDatesValueToPatch` (in `app/ui/EventDatesPicker.tsx`) converts the picked `DateRange` to `IsoDate` today — if it uses `isoDate(pickedDate)` on a local-midnight date, that's the symmetric eastern-hemisphere bug; fix it with a Y/M/D-based formatter (see Step 1).
- Conventions: strict TS, perfectionist import sorting (run `pnpm lint --fix`), Prettier. Unit tests from plan 001 live in `app/ui/dateUtils.test.ts` and `app/schemas.test.ts` and were written TZ-hermetic; `getPaddingDays` characterization tests there will need updating to `getUTCDay` expectations (they were written with UTC-midnight inputs under `TZ=UTC`, so most should pass unchanged — re-check).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Unit tests, western zone | `TZ=America/Los_Angeles pnpm test:unit` | all pass |
| Lint | `pnpm lint` | exit 0 |
| E2E | `pnpm test` | all pass |

## Scope

**In scope** (the only files you should modify/create):
- `app/ui/EventDetails.tsx` (display/grouping reads only)
- `app/ui/getPaddingDays.tsx`
- `app/ui/EditEventForm.tsx`
- `app/ui/EventDatesPicker.tsx` (only the storage↔picker boundary conversions, if Step 1's audit finds the symmetric bug)
- `app/schemas.ts` (add two small helpers, Step 1)
- `app/ui/dateUtils.test.ts`, `app/schemas.test.ts` (extend)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Availability key derivation (`isoDate(day)` at `EventDetails.tsx:387`) and anything in Yjs storage — already UTC-consistent; changing it would corrupt existing events.
- `party/**` — server never does date math.
- Adding a date library (date-fns etc.) — out of scope by AGENTS.md minimalism.
- True timezone support (showing the event in a chosen tz) — that's a product feature (direction finding), not this bug fix.

## Git workflow

- Branch: current working branch; do not commit to `main`.
- Commit style: imperative, e.g. `Read event dates with UTC getters in calendar grid`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add boundary helpers to app/schemas.ts

Add next to the existing date helpers (after `addDays`, ~line 40):

```ts
/** Y/M/D of a UTC-midnight date as a local-midnight date (for react-day-picker). */
export const utcToLocalDay = (date: Date): Date =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** Local-calendar Y/M/D (as picked in react-day-picker) to IsoDate, no tz shifting. */
export const localDayToIso = (date: Date): IsoDate =>
  isoDate(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
```

Then audit `app/ui/EventDatesPicker.tsx`: find where the picked `DateRange` becomes `IsoDate` strings (`eventDatesValueToPatch` and `defaultEventDatesValue`) and where stored ISO strings become picker dates. Route the conversions through these helpers. If the picker code already only ever passes dates back through Y/M/D-safe paths, leave it and note that in your report.

**Verify**: `pnpm typecheck` → exit 0. New unit tests (Step 4) will pin behavior.

### Step 2: UTC reads in the grid (EventDetails.tsx)

- Line 133: `` const monthKey = `${day.getUTCFullYear()}-${day.getUTCMonth()}` ``.
- Lines 279, 283: replace `new Date(startDate).toLocaleDateString()` with `new Date(startDate).toLocaleDateString(undefined, { timeZone: "UTC" })` (same for endDate). Keep the user's locale; pin only the zone.
- Line 354 area: add `timeZone: "UTC"` to the `toLocaleDateString("en-US", {...})` options for the month header.
- Day-number rendering in cells: change `.getDate()` to `.getUTCDate()` (and any `.getDay()` to `.getUTCDay()`) — grep the file: `grep -nE "\.get(Date|Day|Month|FullYear)\(" app/ui/EventDetails.tsx` and convert every hit that operates on a date derived from `startDate`/`endDate`/`eachDayOfInterval`. Hits operating on genuinely-local "now" (if any) stay local — list them in your report.
- Where `groupedDays` is built (line 128-130): `new Date()` fallbacks for missing start/end should become `startOfTodayUtc()` (import exists in `app/schemas.ts`).

**Verify**: `pnpm typecheck` → exit 0; `grep -nE "\.get(Date|Day|Month|FullYear)\(" app/ui/EventDetails.tsx` → zero hits on event-derived dates (each remaining hit justified in the report).

### Step 3: getPaddingDays + EditEventForm

- `app/ui/getPaddingDays.tsx`: `firstDay.getDay()` → `firstDay.getUTCDay()`.
- `app/ui/EditEventForm.tsx`:
  - Lines 22-24: wrap seeds for the picker: `const seedStart = startDate ? utcToLocalDay(new Date(startDate)) : undefined;` (same for `seedEnd`). They feed react-day-picker (`initialRange`, `modifiers`, comparisons) which is local-calendar-based.
  - Lines 33-34: `const today = new Date(); today.setHours(0,0,0,0);` (local midnight — correct for comparing against the now-local seeds and for `disabled: { before: ... }`).
  - `unfoldDateRange` (76-88): iterate with local-day stepping `date.setDate(date.getDate()+1)` is now fine since inputs are local midnights — keep, but add a comment `// inputs are local-midnight dates`. (DST hour drift can't cross a day boundary from midnight in any current IANA zone with the comparison `date <= to` — acceptable.)

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 4: Pin it with unit tests

Extend `app/ui/dateUtils.test.ts` and `app/schemas.test.ts`:
- `getPaddingDays(new Date(Date.UTC(2026, 6, 1)), 1)` → `2` (2026-07-01 is a Wednesday; with week starting Monday, padding = 2). Assert it under both `TZ=UTC` and by re-running suite with `TZ=America/Los_Angeles` (config already hermetic; the LA run is the regression proof).
- `utcToLocalDay(new Date("2026-07-01"))` has `getFullYear()===2026, getMonth()===6, getDate()===1` regardless of TZ.
- `localDayToIso(new Date(2026, 6, 1))` → `"2026-07-01"` regardless of TZ.
- Month-grouping regression: replicate the `monthKey` reduce from EventDetails over `eachDayOfInterval(new Date("2026-07-01"), new Date("2026-07-03"))` and assert a single key `"2026-6"`. (Inline the 3-line reduce in the test; do not import the component.)

**Verify**: `pnpm test:unit` → pass; `TZ=America/Los_Angeles pnpm test:unit` → pass; `TZ=Pacific/Kiritimati pnpm test:unit` (UTC+14, eastern extreme) → pass.

### Step 5: Full e2e

**Verify**: `pnpm test` → all pass. The e2e suite runs in the host TZ; it guards against regressions for east-of-UTC/UTC users. If you can cheaply run the suite once with `TZ=America/Los_Angeles` exported, do it and report results (not a gate — specs may assert author-TZ-formatted strings; report failures, don't fix specs in this plan).

## Test plan

- New unit assertions in `app/ui/dateUtils.test.ts` / `app/schemas.test.ts` (Step 4): padding-day weekday math, both boundary helpers, month-group regression — each run under UTC, UTC-8, and UTC+14.
- Existing e2e: `app/App.spec.ts`, `app/RollingEvent.spec.ts`, `app/EditEventDialog.spec.ts` exercise creation/edit flows end-to-end.

## Done criteria

- [ ] `grep -n "getDay()" app/ui/getPaddingDays.tsx` → no match (now `getUTCDay`)
- [ ] `grep -c "timeZone: \"UTC\"" app/ui/EventDetails.tsx` ≥ 3
- [ ] `pnpm test:unit`, `TZ=America/Los_Angeles pnpm test:unit`, `TZ=Pacific/Kiritimati pnpm test:unit` all exit 0
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0
- [ ] `pnpm test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `EventDatesPicker.tsx`'s conversion code doesn't match the shapes described (e.g. `eventDatesValueToPatch` doesn't exist or already uses UTC-safe conversion in a different idiom) — reconcile before editing, and if ambiguous, stop.
- Any existing e2e spec asserts a **local-formatted** date string that your UTC pinning changes in the host TZ (CI is UTC; locally you may be UTC+2) — that means a spec depended on the bug; report which.
- You find availability keys being derived anywhere from local getters (would mean stored data is already TZ-mixed) — that changes the migration story entirely; stop.
- The react-day-picker `disabled`/`modifiers` props visibly mis-render after the local-midnight conversion (check `pnpm dev` if available).

## Maintenance notes

- The invariant to keep: **storage = IsoDate strings = UTC days; react-day-picker = local Y/M/D days; convert only at the boundary with `utcToLocalDay`/`localDayToIso`.** A reviewer should reject any new `new Date(isoString).getDate()`-style read.
- Real timezone support (event pinned to an IANA zone) is a separate direction-level feature; these helpers are its foundation, not its implementation.
- If date utils later consolidate into `app/utils/date.ts` (DEBT-14), move helpers + tests together.
