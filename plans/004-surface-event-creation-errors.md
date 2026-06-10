# Plan 004: Surface event-creation failures instead of navigating silently

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f6f3369..HEAD -- app/api/postEvent.ts app/App.tsx app/ui/CreateEventForm.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f6f3369`, 2026-06-10

## Why this matters

`postEvent` only treats HTTP 404 as an error; 400 ("invalid event") and 403 ("event already created") responses are parsed and returned as success. `App.tsx` then `catch`es any error just to `console.error` and **navigates to the event URL regardless**. Honest impact assessment: because the local Yjs doc is initialized before the POST and syncs over WebSocket once connected, the event usually still materializes server-side even when the POST fails — so this is not "creation always breaks." The real failure modes are: (a) POST rejected AND WS sync failing (offline, server error) → user shares a dead link with no feedback; (b) server-side validation drift (400) is invisible, masking schema bugs like the ones the merge just touched (rolling events). The TODO at `postEvent.ts:19` already acknowledges this. Small fix, removes a silent-failure class.

## Current state

- `app/api/postEvent.ts` (22 lines, entire file):

```ts
export async function postEvent(calendarEvent: CalendarEvent): Promise<unknown> {
  const res = await fetch(`${serverUrl}/parties/main/${calendarEvent.id}`, {
    body: JSON.stringify(calendarEvent),
    method: "POST",
  });

  if (res.status === 404) {
    throw new Error("server not found");
  }

  const json = await res.json();

  // TODO: If the status was not 200, we should show an error message and retry.
  return json;
}
```

- `app/App.tsx:58-70` — the only caller:

```tsx
<CreateEventForm
  onSubmit={(calendarEvent) => {
    initializeEventMap(yDoc, calendarEvent);

    return postEvent(calendarEvent)
      .catch((error) => {
        console.error("creating event failed", error);
      })
      .then(() => {
        params.set("id", calendarEvent.id);
      });
  }}
/>
```

- Server responses (`party/editor.partyserver.ts:112-137`): 200 `{message:"created"}`; 403 `{error:"event already created"}`; 400 `{error:"invalid event"}`.
- `app/ui/CreateEventForm.tsx` (98 lines) — read it before editing. It owns the submit button and form state; check whether it already has any error/pending UI (it has a `useTransition` or disabled-state pattern — match whatever is there). The retro design system provides plain elements; an inline `<p role="alert">` with the existing error styling used in `app/ui/EventHistory/index.tsx:202` (`className="text-red-500"`) is the established minimal pattern.
- Conventions: minimal/surgical (AGENTS.md). No toast library exists — do not add one.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| E2E | `pnpm test` | all pass |

## Scope

**In scope** (the only files you should modify/create):
- `app/api/postEvent.ts`
- `app/App.tsx` (the `onSubmit` handler only)
- `app/ui/CreateEventForm.tsx` (error display only)
- `app/App.spec.ts` (one new test)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Retry logic / offline queueing — the TODO mentions retry; explicitly deferred (Yjs sync already provides the de-facto retry path).
- `party/editor.partyserver.ts` — server contract unchanged.
- Other `app/api/*` helpers (getHistory, getRoomCount) — same disease, separate small follow-up; keep this diff reviewable.

## Git workflow

- Branch: current working branch; do not commit to `main`.
- Commit style: imperative, e.g. `Surface event-creation errors in the create form`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make postEvent throw on any non-OK response

Replace the 404-only check:

```ts
if (!res.ok) {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: string };
    detail = body.error ?? "";
  } catch {
    // non-JSON error body
  }
  throw new Error(
    `creating event failed (${res.status})${detail ? `: ${detail}` : ""}`,
  );
}

return (await res.json()) as unknown;
```

Remove the stale TODO comment.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Stop navigating on failure; propagate the error

In `app/App.tsx`, rework the handler so navigation only happens on success and the error reaches the form:

```tsx
onSubmit={async (calendarEvent) => {
  initializeEventMap(yDoc, calendarEvent);
  await postEvent(calendarEvent); // throws on failure — CreateEventForm displays it
  params.set("id", calendarEvent.id);
}}
```

Check `CreateEventForm`'s `onSubmit` prop type — it currently expects `Promise<void>` (verify). Then in `app/ui/CreateEventForm.tsx`, add minimal error state around its submit call: `const [error, setError] = useState<Error>()`; clear on new submit, set in a `.catch`, render `{error && <p role="alert" className="text-red-500">{error.message}</p>}` near the submit button, and re-enable the button so the user can retry manually. Match the file's existing state idioms — read it first.

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 3: Regression test

Add one Playwright test to `app/App.spec.ts` (import `test`/`expect` from `../test` like its siblings — check the file's existing imports). Use `page.route` to intercept the POST and return 400:

```ts
test("shows an error when event creation fails", async ({ page }) => {
  await page.route("**/parties/main/*", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 400, json: { error: "invalid event" } })
      : route.fallback(),
  );
  await page.goto("/");
  // fill the create form the way neighboring tests in App.spec.ts do — copy
  // the first few lines of an existing creation test verbatim
  // ...submit...
  await expect(page.getByRole("alert")).toContainText("creating event failed");
  expect(new URL(page.url()).searchParams.get("id")).toBeNull();
});
```

**Verify**: `pnpm test` → all pass including the new test (both projects).

## Test plan

- New e2e test above (the regression this plan fixes: failed POST must not navigate and must show feedback). Pattern: existing creation tests at the top of `app/App.spec.ts`.
- Existing creation happy-path tests in `App.spec.ts` double as the no-regression gate.

## Done criteria

- [ ] `grep -n "res.ok" app/api/postEvent.ts` → 1 match; `grep -n "TODO" app/api/postEvent.ts` → none
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0
- [ ] `pnpm test` exits 0, including the new failure-path test
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `CreateEventForm`'s submit flow doesn't match the assumed shape (e.g. it already swallows errors internally, or `onSubmit` isn't a promise) — reconcile, and stop if the rework grows beyond ~30 lines.
- The new test reveals that navigation happens somewhere other than the `.then` in App.tsx (e.g. a redirect inside CreateEventForm).
- Throwing from postEvent breaks an existing spec that intercepts/depends on the silent path.

## Maintenance notes

- `app/api/getHistory.ts` and `app/api/getRoomCount.ts` still have zero error handling — candidates for the same `!res.ok` treatment in a later cleanup (deliberately excluded here).
- If retry/offline handling is added later, do it at the form level, not inside postEvent (keep the API helper a thin throw-on-error fetch).
