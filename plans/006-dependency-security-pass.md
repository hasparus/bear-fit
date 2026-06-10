# Plan 006: Dependency security pass — patch known CVEs, fix dep placement, prune dead deps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f6f3369..HEAD -- package.json pnpm-lock.yaml app/client.tsx app/ui/UserAvailabilitySummary.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 001 legitimately bumps
> `vitest` in package.json — that change alone is expected, not drift.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (coordinates with 001 on the vitest version — see Step 1)
- **Category**: security / migration
- **Planned at**: commit `f6f3369`, 2026-06-10

## Why this matters

`pnpm audit` at the planned-at commit reports **50 vulnerabilities (1 critical, 20 high)**. The ones that matter: Vite 6.1.1 (dev-server arbitrary file read, GHSA-jqfw-vq24-v9c3, patched in ≥6.3.6), the critical vitest advisory (patched in ≥3.2.6), and a wrangler high. These are dev/build-time, not runtime — bear-fit's deployed Worker isn't directly affected — but `pnpm dev` binds a vulnerable dev server on the LAN and CI runs the toolchain on every PR. Separately, three deps are misfiled or dead weight: `react-scan` and `@types/node` sit in production `dependencies`, and several manifest entries are single-use or unused. This plan is the conservative pass: patch within current majors, fix placement, prune. Major-version migrations (Vite 6→8, ESLint 9→10) are explicitly deferred.

## Current state

- `package.json` at `f6f3369` (verify against live file):
  - `dependencies` (should be runtime-only) includes: `"@types/node": "^22.13.14"` (types — belongs in devDependencies), `"react-scan": "^0.2.9"` (profiling tool — only imported behind a dead flag), `"unsafe-keys": "^1.0.0"` (single call site).
  - `devDependencies`: `"vite": "^6.1.1"`, `"wrangler": "^4.45.3"`, `"vitest": "^3.0.9"` (plan 001 may have bumped this already — fine), `"@cloudflare/vite-plugin": "^1.13.18"`, `"@vitejs/plugin-react": "^4.3.4"`.
  - `pnpm.overrides`: `"@types/react": "19.0.12"`, `"playwright": "1.60.0"`, `"playwright-core": "1.60.0"` — the playwright pins are a deliberate dedupe (commit af466f6); LEAVE them.
- `app/client.tsx:15-21`:

```ts
const SCAN = false;
if (process.env.NODE_ENV === "development" && SCAN) {
  const { scan } = await import("react-scan");
  scan({ enabled: true });
}
```

react-scan is statically unreachable (`SCAN = false`) and dev-only even when enabled; Vite tree-shakes it from prod bundles. The dependency is hygiene debt, not shipped bytes.
- `app/ui/UserAvailabilitySummary.tsx:2,25` — sole importer of `unsafe-keys`: `const userIds = unsafeKeys(availabilityForUsers)`. Direct replacement: `Object.keys(availabilityForUsers) as UserId[]` (check the inferred type at the call site — `availabilityForUsers` is `Record<UserId, IsoDate[]>`).
- Dead schema exports (found during audit, no callers outside `app/schemas.ts`): `AvailabilityKey.split` (lines 107-110) and `AvailabilityDelta` (lines 88-95). Verify with `grep -rn "AvailabilityKey.split\|AvailabilityDelta" app party --include="*.ts*" | grep -v schemas.ts | grep -v ".test.ts"` → should be empty (plan 001's tests may reference them — if its characterization tests assert them, remove those assertions too).
- Audit/outdated ground truth at plan time: `pnpm audit` → 50 vulns (5 low / 24 moderate / 20 high / 1 critical); `pnpm outdated` → 36/36 outdated, including `vite 6.1.1 → 8.0.16`, `react 19.0.0 → 19.2.7`, `@vitejs/plugin-react 4.3.4 → 6.0.2`.
- Build verification baseline: `pnpm build` currently succeeds producing `dist/client/*` and `dist/bear_fit/*`; `pnpm test` green.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Audit | `pnpm audit` | counts strictly lower than 1 critical / 20 high baseline |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0, both client + worker bundles |
| E2E | `pnpm test` | all pass |
| Unit (if 001 landed) | `pnpm test:unit` | all pass |

## Scope

**In scope** (the only files you should modify/create):
- `package.json`
- `pnpm-lock.yaml` (via `pnpm install`/`pnpm up` only)
- `app/client.tsx` (only if removing react-scan entirely — see Step 3)
- `app/ui/UserAvailabilitySummary.tsx` (unsafe-keys inlining)
- `app/schemas.ts` (delete two dead exports)
- `app/schemas.test.ts` (only to drop assertions on deleted exports, if present)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Major-version bumps: Vite 6→7/8, ESLint 9→10, `@vitejs/plugin-react` 4→6, nyc 17→18, React 19.0→19.2 — each needs its own verification cycle; deferred (recorded in plans/README.md).
- `pnpm.overrides` playwright pins — deliberate dedupe.
- `radix-ui` vs `@base-ui-components/react` consolidation — separate debt item, not security.
- `partyserver`/`y-partyserver`/`yjs` versions — core sync path; do not bump in a hygiene pass.

## Git workflow

- Branch: current working branch; do not commit to `main`.
- Commit style: imperative, e.g. `Patch vite and wrangler advisories; move dev tools out of dependencies`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Patch within current majors

- `vite`: `^6.1.1` → latest 6.x that is ≥6.3.6 (`pnpm add -D vite@^6.3.6` then let the range float).
- `wrangler`: `^4.45.3` → latest 4.x (`pnpm up wrangler@4`).
- `vitest`: if plan 001 already bumped to ≥3.2.6, skip; otherwise `pnpm add -D vitest@^3.2.6`.
- `@cloudflare/vite-plugin`: latest 1.x (`pnpm up @cloudflare/vite-plugin@1`) — keep in lockstep with vite 6 compatibility (check its peer range with `pnpm why @cloudflare/vite-plugin` after install).
- Then `pnpm up --no-save=false -r` is NOT wanted — only the named packages above. Refresh transitives that carry advisories: `pnpm up minimatch flatted undici --depth Infinity` is unnecessary churn; instead just run `pnpm audit` and only chase remaining HIGH/CRITICAL items that are *direct or one-hop* — moderate/low transitive noise is out of scope.

**Verify**: `pnpm install` exit 0; `pnpm audit` → 0 critical, and high count strictly below 20 (record the exact remaining counts in your report); `pnpm build` exit 0.

### Step 2: Fix dependency placement

Move `@types/node` from `dependencies` to `devDependencies` (same range). 

**Verify**: `pnpm install` exit 0; `pnpm typecheck` exit 0; `pnpm build` exit 0.

### Step 3: Remove react-scan

The gate is hard-disabled (`SCAN = false`) and has been since the code landed. Remove the dependency AND the dead block (`app/client.tsx:15-21`), including the now-unneeded `const SCAN` line. If the operator wants to keep the tool handy, they can re-add it; dead flags rot. (`pnpm remove react-scan`.)

**Verify**: `grep -rn "react-scan" app party package.json` → no matches; `pnpm build` exit 0.

### Step 4: Inline unsafe-keys; delete dead schema exports

- `app/ui/UserAvailabilitySummary.tsx`: replace `unsafeKeys(availabilityForUsers)` with `Object.keys(availabilityForUsers) as UserId[]`; drop the import; `pnpm remove unsafe-keys`. (Import `type UserId` from `../schemas` if not already imported — check the file.)
- `app/schemas.ts`: delete `AvailabilityKey.split` (lines 107-110) and the `AvailabilityDelta` type+const (lines 88-95) after re-running the caller grep from "Current state". If plan 001's tests assert these, delete those specific assertions.

**Verify**: `pnpm typecheck` exit 0; `pnpm lint` exit 0; `grep -rn "unsafe-keys\|unsafeKeys\|AvailabilityDelta\|AvailabilityKey.split" app party` → no matches.

### Step 5: Full regression

**Verify**: `pnpm test` → all pass (both projects); `pnpm test:unit` (if present) → all pass.

## Test plan

No new tests — this is a dependency/hygiene change gated by the existing suites. The verification gates are: `pnpm audit` deltas, `pnpm build`, full e2e, unit suite.

## Done criteria

- [ ] `pnpm audit` reports 0 critical; high count < 20 (report exact numbers)
- [ ] Installed `vite` ≥ 6.3.6 and < 7 (`pnpm why vite`)
- [ ] `grep -n "react-scan\|unsafe-keys" package.json` → no matches; `@types/node` under devDependencies
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` all exit 0
- [ ] `pnpm.overrides` playwright pins unchanged (`git diff package.json` shows no override edits)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The latest vite 6.x and the latest `@cloudflare/vite-plugin` 1.x have incompatible peer ranges (plugin may now require vite ≥7) — report the actual constraint instead of force-resolving.
- `pnpm audit` still shows a CRITICAL after Step 1 — identify the path (`pnpm why <pkg>`) and report; do not chase it through overrides without sign-off.
- Removing react-scan or unsafe-keys surfaces additional call sites the grep missed (e.g. dynamic import strings).
- `pnpm test` fails after the vite patch bump — capture the failure; do not pin back silently.

## Maintenance notes

- Deferred majors (Vite 7/8, ESLint 10, plugin-react 6, React 19.2, nyc 18, tailwind 4.3) are recorded in plans/README.md as a future migration batch — each wants its own PR with full e2e.
- `partyserver`/`y-partyserver` are 0.x with no semver guarantees — when bumping them later, read their changelogs; they own the sync path.
- Reviewer focus: lockfile diff should show only the named packages and their transitive closures; any unrelated resolution churn means a wider `pnpm up` ran than intended.
