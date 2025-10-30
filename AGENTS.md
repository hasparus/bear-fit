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
