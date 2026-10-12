# Repository Guidelines

## Project Structure & Module Organization

- `app/` contains the React UI, shared schemas, and Playwright specs (e.g.
  `App.spec.tsx`); browser entry points are `app/client.tsx` and
  `app/dashboard/index.tsx`.
- `party/` owns the Cloudflare Worker (`worker.ts`) and its PartyServer Durable
  Objects (`editor.partyserver.ts`, `occupancy.partyserver.ts`), while `public/`
  serves static files and `assets/` stores README media.
- Tooling lives beside the code: `test/` holds Playwright artifacts and helpers,
  `scripts/` includes deployment automation, and Vite with
  `@cloudflare/vite-plugin` builds both the client and the Worker.

## Build, Test, and Development Commands

- `pnpm dev` (or `pnpm dev:prod` to run against the prod server) runs the app
  and the Worker locally through Vite.
- `pnpm typecheck` and `pnpm lint` keep strict TypeScript and ESLint
  (perfectionist sorting) happy; follow with `pnpm format` before committing.
- `pnpm test` runs the Durable Object tests (`party/*.test.ts`, Vitest in
  workerd) and then the Playwright suite headlessly, `pnpm test:ui` opens the
  inspector, and `pnpm release` executes `scripts/deploy.sh` to deploy with an
  `APP_VERSION` tag.

## Coding Style & Naming Conventions

- DO NOT OVERENGINEER. WE WANT MINIMAL, SURGICAL WORK.
- Components and hooks stay PascalCase or camelCase (`CreateCalendarForm`,
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

- Mirror the existing imperative commit voice (`Improve grid cell tooltip`).
- Add UI screenshots or clips when layout shifts, link related issues, and list
  any follow-up work so reviewers can track it.
