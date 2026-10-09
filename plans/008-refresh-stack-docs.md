# Plan 008: Refresh repo docs to match the Cloudflare Workers + partyserver stack

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f6f3369..HEAD -- AGENTS.md README.md MIGRATION_NOTES.md SECURITY_PLAN.ai-slop.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / dx
- **Planned at**: commit `f6f3369`, 2026-06-10

## Why this matters

The repo migrated from PartyKit to Cloudflare Workers + partyserver (MIGRATION_NOTES.md documents the decisions), but the two documents agents and humans actually read first still describe the old world. AGENTS.md tells a contributor to expect a PartyKit dev server on port 1999, references a deleted build plugin, and names a `party/server.ts` that doesn't exist. README's tech-stack section says PartyKit and embeds two images deleted from `assets/`. Every agent session that starts from these files burns context discovering they're wrong — in a repo whose own AGENTS.md mandates agent workflows, stale agent docs are the highest-leverage docs bug. A fresh clone also has no documented path to a working `pnpm dev` (the `PUBLIC_KEY_B64` var is only seeded by running Playwright).

## Current state

- `AGENTS.md` (verify each before editing):
  - Lines 5-9: "browser entry points are `app/client.tsx` and `app/dashboard/index.tsx`" (still true); "`party/` owns PartyKit rooms and the server entry in `server.ts`" (false — files are `party/worker.ts`, `party/editor.partyserver.ts`, `party/occupancy.partyserver.ts`, `party/rooms.ts`, `party/shared.ts`); "`public/` serves static files and `assets/` stores reference media" (public/ true; assets/ now holds nothing but `.DS_Store` after the merge deleted the gifs).
  - Lines 10-12: references `esbuild-postcss-plugin.cjs` — deleted; Tailwind 4 now comes via `@tailwindcss/vite` in `vite.config.ts`.
  - Lines 16-17: "`pnpm dev` ... serves the PartyKit app with live reload on `http://127.0.0.1:1999`" — now `vite dev` (default port 5173) with `@cloudflare/vite-plugin` running the Worker + DOs locally; 1999 is only the `vite preview` port used by Playwright (`playwright.config.ts:70,75`).
  - Line 38: "Name end-to-end files `*.spec.ts(x)`" — specs are `.spec.ts` now (the merge renamed `App.spec.tsx` → `App.spec.ts`); also, after plan 001, `*.test.ts` = vitest unit tests, a distinction worth one sentence.
  - Lines 50-56 ("Current Focus"): "We're migrating from Partykit to PartyServer. But first, we need a full end-to-end coverage." — the migration is DONE; e2e coverage exists (8 spec files, 65% CI gate).
  - Beads section (58-139): keep — `.beads/issues.jsonl` shows real usage (issues bear-fit-1..6, Oct 2025).
- `README.md`:
  - Line 3: `![](./assets/screen-recording.gif)` — file deleted (confirm: `ls assets/` → only `.DS_Store`).
  - Line 31: `![](assets/chat.png)` — deleted.
  - Lines 19-29 (tech stack): lists "PartyKit 🎈"; no mention of Cloudflare Workers, partyserver, or Vite. The cursor-party paragraph (line 27-29) is still accurate.
  - No setup/getting-started section at all.
- `MIGRATION_NOTES.md` — accurate, recent; keep but retitle context (it reads as in-flight; add a "migration complete" line).
- `SECURITY_PLAN.ai-slop.md` (5.0K, tracked) — self-labeled AI slop at the repo root.
- `.dev.vars` is gitignored; `playwright.config.ts:22-31` generates it from `.ssh/test/id_ed25519.pub`. There is no `.dev.vars.example`.
- Conventions: prose docs are Prettier-formatted with `proseWrap: always` (`.prettierrc`) — run `pnpm format` after editing markdown.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Format | `pnpm format` | exit 0 |
| Link/path sanity | `grep -n "partykit\|PartyKit\|server.ts\|esbuild" AGENTS.md README.md` | only intentional mentions remain |
| E2E unaffected | `pnpm test` | all pass (docs-only change; run once) |

## Scope

**In scope** (the only files you should modify/create):
- `AGENTS.md`
- `README.md`
- `MIGRATION_NOTES.md` (one-line status header only)
- `SECURITY_PLAN.ai-slop.md` (delete — see Step 4)
- `.dev.vars.example` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `todo.gitignored.md` — operator's private scratchpad (gitignored; not your business).
- Re-recording screenshots/GIFs — leave a placeholder comment; media production isn't an executor task.
- `.beads/` content.
- Any source or config file.

## Git workflow

- Branch: current working branch; do not commit to `main`.
- Commit style: imperative, e.g. `Update AGENTS.md and README for the Workers + partyserver stack`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite the stale sections of AGENTS.md

Apply these corrections, preserving the file's structure, tone, and the Beads section verbatim:

- Project structure: `party/` owns the Cloudflare Worker (`party/worker.ts` routes via `routePartykitRequest`) and two Durable Objects — `party/editor.partyserver.ts` (Yjs event docs, SQLite persistence) and `party/occupancy.partyserver.ts` (room-count dashboard backend); shared schemas in `party/rooms.ts` / `party/shared.ts`. `public/` is Vite's publicDir (fonts, retro-fonts.css, button SVGs).
- Build tooling: Vite 6 multi-page app (`index.html`, `dashboard.html` at root, registered in `vite.config.ts`), Tailwind 4 via `@tailwindcss/vite`, Worker + DOs in dev via `@cloudflare/vite-plugin`. Remove the esbuild-postcss-plugin sentence.
- Commands: `pnpm dev` = `vite dev` (Worker runs in-process; default Vite port). `pnpm test` = `vite build` + Playwright against `vite preview` on port 1999. Mention `.dev.vars` is auto-written by `playwright.config.ts` from the committed TEST key, and prod uses `wrangler secret` (one sentence, link MIGRATION_NOTES.md).
- Testing: specs are `app/*.spec.ts` (Playwright); if plan 001 has landed (check for `vitest.config.ts`), add: unit tests are `app/**/*.test.ts` via `pnpm test:unit`.
- Current Focus: replace with the actual current state — migration complete; focus per plans/README.md (link it).

**Verify**: `grep -n "esbuild\|server.ts\|1999" AGENTS.md` → only the intentional `vite preview --port 1999` mention (if you kept it) remains; no PartyKit-as-current-stack claims (`grep -in "partykit" AGENTS.md` → only historical/migration references).

### Step 2: Fix README

- Remove both dead image embeds (lines 3 and 31). For the screen recording, leave `<!-- TODO: re-record demo gif (old one removed in the retro-theme PR) -->`.
- Tech stack: replace the PartyKit entry with Cloudflare Workers (Durable Objects) + [partyserver](https://github.com/cloudflare/partyserver), keep system.css/Yjs/React/TypeScript entries, add Vite. Keep the playful tone and emoji style of the section — match the existing voice, don't corporate-ify it.
- Add a short "running locally" section: `pnpm install`, `pnpm dev`; note that `pnpm test` seeds `.dev.vars` automatically, or `cp .dev.vars.example .dev.vars` first; `pnpm test` for e2e.

**Verify**: `grep -n "assets/" README.md` → no image references to deleted files; `grep -in "partykit" README.md` → only the cursor-party credit (which genuinely runs on partykit.dev) remains.

### Step 3: Create .dev.vars.example and stamp MIGRATION_NOTES

- `.dev.vars.example` content (the test public key is committed and public by design — but do NOT inline it; point at the generator):

```
# Copy to .dev.vars (or just run `pnpm test` once — playwright.config.ts writes it).
# Dev/CI use the committed TEST keypair in .ssh/test/. Prod sets this via `wrangler secret put PUBLIC_KEY_B64`.
PUBLIC_KEY_B64="<contents of .ssh/test/id_ed25519.pub>"
```

- Confirm `.dev.vars.example` is NOT gitignored (`git check-ignore .dev.vars.example` → no output) — the `.gitignore` pattern is `.dev.vars` exact (verify; if a glob catches the example file, adjust the gitignore line for it).
- Top of `MIGRATION_NOTES.md`: add `> Status: migration completed (2025-11). Kept as a decision record.` (date from git: `git log --reverse --oneline -- MIGRATION_NOTES.md | head -1` → use that commit's date).

**Verify**: `git status` shows `.dev.vars.example` as a new tracked-able file; `git check-ignore .dev.vars.example` → exits non-zero (not ignored).

### Step 4: Remove SECURITY_PLAN.ai-slop.md

`git rm SECURITY_PLAN.ai-slop.md`. Rationale recorded here so the executor doesn't have to judge: it's self-labeled unvetted AI output at the repo root; the real security work is tracked in plans/005 and 007. If the operator wants a curated SECURITY.md later, it should be written fresh.

**Verify**: `git status` shows the deletion staged; `ls SECURITY_PLAN.ai-slop.md` → no such file.

### Step 5: Format and sanity-run

`pnpm format` (Prettier owns markdown wrapping). Then one e2e run to prove docs-only.

**Verify**: `pnpm format` exit 0 with no unexpected source-file changes (`git status` — only in-scope files); `pnpm test` → all pass.

## Test plan

Docs-only: the greps in each step are the tests. One full `pnpm test` run guards against accidental source edits.

## Done criteria

- [ ] `grep -in "partykit" AGENTS.md README.md` → only the cursor-party credit and explicitly-historical migration mentions
- [ ] `grep -n "esbuild-postcss\|party/server.ts" AGENTS.md README.md` → no matches
- [ ] No references to `assets/screen-recording.gif` or `assets/chat.png` anywhere (`grep -rn "screen-recording\|chat.png" --include="*.md" .` excluding node_modules/plans)
- [ ] `.dev.vars.example` exists and is not gitignored
- [ ] `SECURITY_PLAN.ai-slop.md` deleted
- [ ] `pnpm test` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- AGENTS.md or README has been substantially rewritten since `f6f3369` (drift check) — re-derive the deltas instead of applying these verbatim.
- You find the deleted README images actually exist elsewhere (e.g. moved to `public/`) — link them instead of removing.
- `git rm` of SECURITY_PLAN.ai-slop.md conflicts with an operator change to that file after `f6f3369`.

## Maintenance notes

- AGENTS.md's command section will drift again when plans 001 (test:unit) and 005-007 land — whoever executes those last should re-read it (plan 001's step already adds its own line if landed first).
- The README demo-gif TODO is intentionally left for the operator (needs a human screen recording).
- If the repo later adopts a CONTRIBUTING.md, the setup section in README is the seed for it.
