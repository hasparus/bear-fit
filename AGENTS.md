# Repository Guidelines

## Project Structure & Module Organization

- `app/` contains the React UI, shared schemas, and Playwright specs (e.g.
  `App.spec.tsx`); browser entry points are `app/client.tsx` and
  `app/dashboard/index.tsx`.
- `party/` owns PartyKit rooms and the server entry in `server.ts`, while
  `public/` serves static files and `assets/` stores reference media.
- Tooling lives beside the code: `test/` holds Playwright artifacts and helpers,
  `scripts/` includes deployment automation, and `esbuild-postcss-plugin.cjs`
  wires Tailwind 4 into the build.

## Build, Test, and Development Commands

- `pnpm dev` (or `pnpm dev:prod` to run against prod server) serves the PartyKit
  app with live reload on `http://127.0.0.1:1999`.
- `pnpm typecheck` and `pnpm lint` keep strict TypeScript and ESLint
  (perfectionist sorting) happy; follow with `pnpm format` before committing.
- `pnpm test` runs the Playwright suite headlessly, `pnpm test:ui` opens the
  inspector, and `pnpm release` executes `scripts/deploy.sh` to deploy with an
  `APP_VERSION` tag.

## Coding Style & Naming Conventions

- Components and hooks stay PascalCase or camelCase (`CreateEventForm`,
  `useSearchParams`), while constants use upper snake case (`APP_VERSION`).
- Lint auto-fixes handle import/key ordering via `eslint-plugin-perfectionist`;
  avoid manual reorderings.
- Don't worry about formatting, just run Prettier.

## Testing Guidelines

- Playwright is the source of truth; keep specs deterministic, reuse helpers in
  `test/utils/`, and delete temporary downloads during cleanup.
- Name end-to-end files `*.spec.ts(x)` so `playwright.config.ts` picks them up
  from `./app`; UIs should be driven through visible interactions.
- Run `pnpm test` locally before submitting—CI retries twice, so any flaky flow
  must be stabilized before review.

## Commit & Pull Request Guidelines

- Mirror the existing imperative commit voice (`Improve grid cell tooltip`) and
  group related edits together.
- PRs need a concise summary, testing notes (`pnpm test`), and relevant PartyKit
  preview URLs from `pnpm release` when you deploy.
- Add UI screenshots or clips when layout shifts, link related issues, and list
  any follow-up work so reviewers can track it.

# Current Focus

We're migrating from Partykit to PartyServer.

But first, we need a full end-to-end coverage.

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

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

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
