# Repository Guidelines

## Project Structure & Module Organization

- `app/` contains the React UI, shared schemas, and Playwright specs (e.g.
  `App.spec.ts`); browser entry points are `app/client.tsx` and
  `app/dashboard/index.tsx`.
- `party/` owns the Cloudflare Worker and its Durable Objects: `party/worker.ts`
  routes requests via `routePartykitRequest`, `party/editor.partyserver.ts` is
  the Yjs event-doc server (SQLite persistence), and
  `party/occupancy.partyserver.ts` backs the room-count dashboard; shared
  schemas live in `party/rooms.ts` and `party/shared.ts`.
- `public/` is Vite's publicDir (fonts, `retro-fonts.css`, button SVGs).
- The app is a Vite 6 multi-page build: `index.html` and `dashboard.html` at the
  root are registered in `vite.config.ts`; Tailwind 4 comes via
  `@tailwindcss/vite`, and `@cloudflare/vite-plugin` runs the Worker + Durable
  Objects in dev.
- Tooling lives beside the code: `test/` holds Playwright artifacts and helpers,
  and `scripts/` includes deployment automation.

## Build, Test, and Development Commands

- `pnpm dev` (or `pnpm dev:prod` to run against the prod server) runs `vite dev`
  with the Worker and Durable Objects in-process on the default Vite port.
- `pnpm typecheck` and `pnpm lint` keep strict TypeScript and ESLint
  (perfectionist sorting) happy; follow with `pnpm format` before committing.
- `pnpm test` runs `vite build` and then the Playwright suite headlessly against
  `vite preview` on port 1999; `pnpm test:ui` opens the inspector, and
  `pnpm release` executes `scripts/deploy.sh` to deploy with an `APP_VERSION`
  tag.
- `playwright.config.ts` auto-writes `.dev.vars` (`PUBLIC_KEY_B64`) from the
  committed TEST key in `.ssh/test/`; prod sets it via `wrangler secret` — see
  `MIGRATION_NOTES.md`.

## Coding Style & Naming Conventions

- DO NOT OVERENGINEER. WE WANT MINIMAL, SURGICAL WORK.
- Components and hooks stay PascalCase or camelCase (`CreateEventForm`,
  `useSearchParams`), while constants use upper snake case (`APP_VERSION`).
- Lint auto-fixes handle import/key ordering via `eslint-plugin-perfectionist`;
  avoid manual reorderings.
- Don't worry about formatting, just run Prettier.

## Testing Guidelines

- Playwright is the source of truth; keep specs deterministic, reuse helpers in
  `test/utils/`, and delete temporary downloads during cleanup.
- Name end-to-end files `*.spec.ts` so `playwright.config.ts` picks them up from
  `./app`; UIs should be driven through visible interactions.
- Run `pnpm test` locally before submitting—CI retries twice, so any flaky flow
  must be stabilized before review.

## Commit & Pull Request Guidelines

- Mirror the existing imperative commit voice (`Improve grid cell tooltip`).
- Add UI screenshots or clips when layout shifts, link related issues, and list
  any follow-up work so reviewers can track it.

---

# Current Focus

The PartyKit → Cloudflare Workers + partyserver migration is complete (see
`MIGRATION_NOTES.md`), and end-to-end coverage is in place. Current work is
tracked in `plans/README.md`.

---

# Beads

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT
use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`
   - Remember to close tasks, this is important.

### MCP Server

If using MCP-compatible clients, use `mcp__beads__*` functions instead of CLI
commands.

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems
