# Add PostHog feature flags

Use this skill to add the cheap feature-flags path to an **existing PostHog install** on **Next.js App Router 15.3+**. Flags are evaluated once per request on the server with `posthog-node`'s `evaluateFlags()`, those values are bootstrapped into the client so the first paint has no flicker and no extra `/flags` fetch, and `/flags` polling is off in CI.

This skill **extends** `npx @posthog/wizard` (or an equivalent existing `posthog-js` / `posthog-node` init). It does not replace the default integration, does not invent a second analytics init, and aborts if PostHog is not already initialized.

This is a **production-safe install**. It does not turn a new flag on for real users. A kill-switch demo is optional: after they confirm a UI path, create one boolean flag at **0% rollout** and gate that path additively. Flag-off (including 0%) = current behavior. They test by raising rollout to 100% in PostHog, then setting it back to 0%.

This is **not** `wizard audit feature-flags` (read-only, after the fact). This is **not** the default `wizard` install (product analytics). This skill is the flags layer: reuse the existing SDK, add bootstrap, then optionally create-and-gate.

## Scope and guardrails

- **Next.js App Router 15.3+ only.** Require `next` in `package.json` at **15.3.0 or newer** and an `app/` directory (or `src/app/`). If the project is Pages Router, Next below 15.3, a different framework, or backend-only, **stop**: emit `[ABORT] unsupported stack for feature flags` on its own line and do nothing else. Do not invent a second pattern. Do not add local evaluation. Do not install `@posthog/next`.
- **Existing PostHog init required.** This skill extends an existing client init (`posthog.init`, `PostHogProvider`, or `instrumentation-client` with `posthog-js`). If none is present, **stop**: emit `[ABORT] posthog not initialized` and tell them to run `npx @posthog/wizard` first. Do not write env or install packages on the way to that abort.
- **One evaluation per request.** Call `evaluateFlags(distinctId)` once, then read with `flags.isEnabled(key)` / `flags.getFlag(key)`. Do not call the deprecated `getFeatureFlag`, `isFeatureEnabled`, or `getAllFlags` — each of those is its own `/flags` request.
- **Same distinct_id on server and client.** Percentage rollout is deterministic per id. If they differ, bootstrap lies.
- **Additive gating only.** Flag off = current behavior. Never gate auth, checkout, payments, data-mutation handlers, or middleware that can 404 a route.
- **Off until they turn it on.** Never create a flag at 100% rollout. Never create a flag before they confirm a gate target. Skip = no new flag in PostHog and no `isEnabled('invented-key')` in layout. Confirm = one boolean flag, **active, 0% rollout**, plus one additive UI path. Production users keep seeing today's UI until someone raises rollout in PostHog.
- **Minimal, additive changes.** Match the project's folder style. Read a file immediately before editing it. Do not restructure unrelated code. Do not commit.

### Abort cases

If anything blocks the run, **always** emit exactly one `[ABORT] <reason>` line and stop — never halt, finish, or error out silently. The wizard catches `[ABORT]` and terminates the run for you; don't try to exit yourself. A silent stop is recorded as a failed run with no reason, which can't be acted on, so every dead end must carry a reason. Use one of:

- `[ABORT] unsupported stack for feature flags` — no `app/` directory, `next` is not a dependency, or `next` is below 15.3.0.
- `[ABORT] posthog not initialized` — no `posthog.init`, `PostHogProvider`, or `instrumentation-client` client init. This skill extends an existing install; tell them to run `npx @posthog/wizard` first.
- `[ABORT] no posthog project credentials` — init exists, but no `phc_…` token in env and no PostHog MCP available to fetch one.
- `[ABORT] could not create the feature flag` — they confirmed a gate target, but creating the 0% flag failed after retry (missing `feature_flag:write`, or the create tool errored).
- `[ABORT] <short specific reason>` — anything else that blocks the run (e.g. no readable project). Keep it short and specific so it's useful when aggregated across runs. Do not paper over a failed flag create by writing "create this manually" and continuing.

## Available tools

{{> mcp-tool-calling}}

Wizard tools (when running inside the wizard):

- `mcp__wizard-tools__wizard_ask` — the only way to ask which UI path to gate. Call it **exactly once**. Do not ask via chat.
- `mcp__wizard-tools__check_env_keys` / `mcp__wizard-tools__set_env_values` — env keys. Never hardcode the project token.

For PostHog operations (create a flag, look up a flag by key, list projects, query `$feature_flag_called`), go through `exec` as above. Inner tool names move; discover them, don't assume them.

## Instructions

Follow these steps IN ORDER. Emit the `[STATUS]` line named at the start of each step.

### STEP 1: Confirm Next.js App Router

Emit `[STATUS] Detecting Next.js App Router`.

Look for `next` in `package.json` **and** an `app/` directory (or `src/app/`). The lockfile decides the package manager (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`).

Read `dependencies.next` / `devDependencies.next`. Strip `^` `~` `>=`. If the version is below **15.3.0**, apply the unsupported-stack abort. In the same message, say the version you found and that this pattern needs Next.js 15.3+ (App Router). Do not invent a Pages Router or pre-15.3 layout-only path.

If this is not Next.js App Router 15.3+, apply the unsupported-stack abort. In the same message, say where you looked.

Record: package manager, whether `src/` is used, the `next` version, and whether PostHog is already initialized (`posthog.init`, `PostHogProvider`, `instrumentation-client`, `posthog-js` / `posthog-node` in dependencies). If flags are already wired the way this skill describes (`evaluateFlags` + bootstrap + a gated call site), verify they are correct and skip to STEP 10.

### STEP 2: Credentials and existing init

Emit `[STATUS] Resolving PostHog credentials`.

PostHog must already be initialized (`posthog.init`, `PostHogProvider`, or `instrumentation-client` with `posthog-js`). This skill does not replace `npx @posthog/wizard`. If there is no client init, emit `[ABORT] posthog not initialized` and stop. In the same message, tell them to run `npx @posthog/wizard` and re-run this command. Do not write env or install packages after that abort.

- If `.env` / `.env.local` already has a `phc_…` token and a host, **reuse those key names**. Do not rename working names. Copy the env names from `example-apps/next-app-router` (`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`) only when creating missing keys — do not invent parallel names.
- If init exists but the token is missing: fetch `api_token` via PostHog MCP (the wizard OAuth session can supply it). If several projects come back, use the one this session is authenticated to. If that is unclear, abort `no posthog project credentials` rather than guessing.
- Host: `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU). Match the project's region from the MCP response.
- Write `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` via `set_env_values` **only if those keys are missing**. Never hardcode. Never write env if you are about to abort for missing init.

Do not add a second `posthog.init`. STEP 8 may relocate an existing `instrumentation-client` init into `PostHogProvider` so bootstrap can be passed per request — that is flags wiring, not a new integration.

### STEP 3: Packages

Emit `[STATUS] Installing PostHog packages`.

Use the project's package manager. **Do not reinstall working versions** — this is not a second integration.

- If `posthog-js` / `posthog-node` are already in `package.json`, leave them. Bump `posthog-node` **only** if `evaluateFlags` is missing from the installed package.
- If `@posthog/react` is missing, add it (hooks + `PostHogProvider`). Import **both** `PostHogProvider` and `useFeatureFlagEnabled` from `@posthog/react`. Do not import the provider from `posthog-js/react`.
- Do not install `@posthog/next`.

### STEP 4: Server client

Emit `[STATUS] Adding the server client`.

If a server helper already exists (e.g. `lib/posthog-server.ts` from the default integration / `example-apps/next-app-router`), **reuse it** — keep `flushAt: 1` / `flushInterval: 0`. Do not add a second client. If none exists, add a small helper matching the project's folder style (`lib/posthog-server.ts` or `app/posthog.ts`):

```ts
import { PostHog } from 'posthog-node'

export function PostHogServer(token: string) {
  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  })
}
```

`flushAt: 1` / `flushInterval: 0` is required in Next.js server functions — they freeze before a batched flush lands. Always `await client.shutdown()` after evaluating. A missing token is handled in STEP 7 (render children without evaluating); do not throw at import time.

### STEP 5: Distinct ID

Emit `[STATUS] Wiring a shared distinct id`.

- **Identified app** (`posthog.identify`, a session user id, etc.): use that stable id on the server and bootstrap `distinctID` with `isIdentifiedID: true`. Do not add the cookie below.
- **Anonymous app**: persist one id in a `ph_distinct_id` cookie. Mint it in `middleware.ts` **only if missing**, and copy the same value onto the request as `x-ph-distinct-id` so the root layout can read it on the minting request. Read cookie first, then the header. Bootstrap `distinctID` with `isIdentifiedID: false` so the client SDK adopts that id — after hydration, `posthog.get_distinct_id()` matches. Do not call `identify()` with a shared literal like `"anonymous"`. If `middleware.ts` already exists, add the cookie logic to the existing handler — do not replace it.
- **Do not** mint a distinct id in the layout. Never `crypto.randomUUID()` (or any per-request random) as `bootstrap.distinctID` — that is a volatile id and blocks later `identify()` merges. If cookie and header are both missing, skip `evaluateFlags` for that request and render `{children}` without bootstrap (same as a missing token). Middleware will set the cookie; the next request evaluates.

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const existing = request.cookies.get('ph_distinct_id')?.value
  const distinctId = existing ?? crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-ph-distinct-id', distinctId)
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  if (!existing) {
    response.cookies.set('ph_distinct_id', distinctId, { path: '/' })
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

Reading `cookies()` in the root layout opts that tree into dynamic rendering. That is required — flags are per-user.

Do not introduce local evaluation.

### STEP 6: Confirm the gate target

Emit `[STATUS] Asking which UI path to gate`.

Flags change production UI. Ask **once**, then create a flag and gate only if they picked a target.

1. Scan pages and components for additive surfaces (a banner, an extra card, an empty-state illustration). Prefer a new element over wrapping existing critical logic.
2. Never propose gating auth, checkout, payments, data-mutation handlers, or route-blocking middleware.
3. If the scan found no safe additive surface: do **not** abort. Do **not** call `wizard_ask`. Treat as skip (`flagKey` unset) and continue to STEP 8. The example gate is optional; the SDK install is the product. Record in the report that gating was skipped because no safe UI surface was found.
4. Otherwise call `mcp__wizard-tools__wizard_ask` **exactly once**:
   - `subject`: `"gate-target"`
   - one `kind: "select"` question
   - `prompt`: the SDK install does not change what users see. Optionally add one additive UI path behind a new boolean flag at **0% rollout** (off for everyone, including production, until someone raises rollout in PostHog). Pick a low-risk target or skip.
   - Put **skip first** so it is the default highlight — an accidental Enter then declines instead of wrapping UI: `{ label: "Skip gating — install only", value: "skip" }`, then the recommended additive target (label includes "recommended"), then 1–2 alternatives.
5. If `wizard_ask` errors (CI / headless): do not fail. Treat it as the recommended additive target (still 0% rollout) and record in the report that the target was auto-picked because the host was non-interactive.
6. If they pick `skip`: do **not** create a flag. Do **not** call `isEnabled` / `getFlag` on an invented key. Continue to STEP 8 with no `flagKey`. Write the report saying no flag was created and no UI was gated.

Do not ask any other question. Credentials come from MCP/env, not from the user.

### STEP 7: Create one boolean flag at 0%

Emit `[STATUS] Creating the feature flag`.

If STEP 6 returned `skip`, skip this step (`flagKey` stays unset).

Otherwise search existing flags for a key matching the feature they confirmed. Reuse it if it is a boolean flag. Otherwise create one:

- key: kebab-case, descriptive (`new-todo-empty-state`, `show-about-banner`)
- type: boolean, not multivariate
- active: true
- rollout: **0%** (release condition group with `rollout_percentage: 0` and no extra property filters). Never 100%. 0% is what makes this safe to merge: production users keep current UI. Manual test is raising that slider to 100% in PostHog, then setting it back.
- name: one sentence naming the UI path it will gate

Create via `exec`. If create fails, retry once after `info`; then emit `[ABORT] could not create the feature flag` and stop. Do not leave a "create this manually" note and continue.

### STEP 8: Client provider with bootstrap

Emit `[STATUS] Bootstrapping flags into the client`.

The root layout is a Server Component. Init already exists (STEP 2). You are adding bootstrap, not a first install.

If `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is missing, render `{children}` without evaluating or wrapping — boot must still work. Otherwise evaluate once and pass the snapshot into the provider.

Only read a specific key when STEP 7 created (or reused) one. Do not invent a key to satisfy this snippet. Bootstrap docs drop false and empty values — at 0% rollout `getFlag` is `false`, so `featureFlags` is `{}`. That is correct: the client matches "off."

```ts
import { cookies, headers } from 'next/headers'

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const cookieStore = await cookies()
const headerStore = await headers()
const distinctId =
  cookieStore.get('ph_distinct_id')?.value ??
  headerStore.get('x-ph-distinct-id')

if (!token || !distinctId) {
  return <html><body>{children}</body></html>
}

const client = PostHogServer(token)
const flags = await client.evaluateFlags(distinctId)
const featureFlags: Record<string, boolean | string> = {}
if (flagKey) {
  const value = flags.getFlag(flagKey)
  if (value) featureFlags[flagKey] = value
}
await client.shutdown()
```

For an identified app, skip the cookie/header and pass the stable user id as `distinctID` with `isIdentifiedID: true` instead.

Add `app/providers.tsx` (or `src/app/providers.tsx`) and wrap `{children}` from the root layout. Use the `apiKey` + `options` form of `PostHogProvider` (not `client={posthog}`) so bootstrap can be passed per request:

```tsx
'use client'
import { PostHogProvider } from '@posthog/react'

export function PHProvider({
  children,
  bootstrap,
}: {
  children: React.ReactNode
  bootstrap: {
    distinctID: string
    isIdentifiedID?: boolean
    featureFlags: Record<string, boolean | string>
  }
}) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!token) return children

  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true'
  return (
    <PostHogProvider
      apiKey={token}
      options={{
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        bootstrap,
        ...(isTestEnv && { advanced_disable_feature_flags: true }),
      }}
    >
      {children}
    </PostHogProvider>
  )
}
```

`advanced_disable_feature_flags: true` in test/CI stops forgotten CI jobs from polling `/flags` (see `cutting-costs.md`). A missing token in production is a no-op (render `children`); in development throw the missing-config error named in the framework guidelines.

**If `instrumentation-client.ts` (or `.js`) already inits `posthog-js`:** move that init into this provider so bootstrap can be passed per request. Keep the existing `api_host` / `defaults` / other options. Do not leave both inits in place. The `nextjs-flags-bootstrap` commandment is the source of truth — the generic Next.js commandment (`instrumentation-client.ts`) is the analytics-simple path and does not apply here.

**If there is no existing client init:** the provider is the only client init. Do not add `instrumentation-client.ts`.

### STEP 9: Gate the chosen path

Emit `[STATUS] Gating the chosen UI path`.

If STEP 6 returned `skip`, skip this step. Otherwise additive only — flag off (including 0% rollout) = current behavior:

```tsx
'use client'
import { useFeatureFlagEnabled } from '@posthog/react'

export function FlaggedBanner() {
  const enabled = useFeatureFlagEnabled('<flag-key>', false)
  if (!enabled) return null
  return <aside>This banner is gated by <code>&lt;flag-key&gt;</code>.</aside>
}
```

Pass `false` as the default so the type is `boolean` and the new element stays hidden while flags load. Read the target file immediately before editing it. Do not restructure the file.

### STEP 10: Verify

Emit `[STATUS] Verifying the flag`.

1. Typecheck / lint the files you touched (`tsc --noEmit`, or the project's `build` if that is the only check). Fix errors you introduced.
2. If a flag was created: look it up by key and confirm it exists, is boolean, is active, and is **0% rollout**. Then `evaluateFlags(distinctId)` → `flags.isEnabled(flagKey)` should be **`false`**. That is the production-safe check. `await client.shutdown()`. Do not treat "flag is off" as a failure.
3. If a flag was created, query `$feature_flag_called` for that flag key in the last 15 minutes via `exec`. If the event has not landed yet, record it in the report as a warning (ingestion can lag about a minute; the app may not have been requested yet) — not an abort.
4. If they skipped gating: confirm no new flag was created and layout does not `isEnabled` / `getFlag` a demo key.

### STEP 11: Report

Emit `[STATUS] Writing the report`.

Write `./posthog-feature-flags-report.md` at the project root covering:

- Stack detected and the pattern used (server `evaluateFlags` → client bootstrap)
- Packages added and files changed
- Whether a flag was created. If yes: key, 0% rollout, PostHog URL. If skip (user declined, or no safe UI surface was found): say no flag was created
- Which UI path was gated (or skipped) and why it was additive — if skipped for no safe surface, say that plainly
- Bill-aware defaults: one `evaluateFlags` per request, CI `advanced_disable_feature_flags`, no local evaluation
- Constraints of this install, named plainly: existing init was required; anonymous `ph_distinct_id` cookie (if used); `instrumentation-client` init relocated (if it was); bootstrap seeds only enabled flags (`false` is dropped by the client SDK); 0% default so production users are unchanged; gate target auto-picked on a non-interactive host (if it was); Next.js version recorded
- How to demo the kill-switch (only if a path was gated): PostHog → that flag → set rollout to **100%** → save → reload the app → gated UI appears → set rollout back to **0%** → reload → UI disappears. Do not tell them to start from 100%.
- Out of scope: local evaluation, experiments, multivariate flags, other frameworks

## Reference files

{references}

`libraries/next-js.md` is the source of truth for the Next.js SDK (App Router server client, env names). `bootstrapping.md` is the source of truth for `bootstrap.featureFlags` and matching `distinctID`. `cutting-costs.md` is why flags are disabled in CI and why local evaluation is not the default. `adding-feature-flag-code.md` is the source of truth for `evaluateFlags` and `useFeatureFlagEnabled`. `start-here.md` is the product overview.

## Key principles

- **One stack, one pattern.** Next.js App Router 15.3+ + existing PostHog init + server `evaluateFlags` + client bootstrap. Everything else aborts.
- **Extend, don't reinstall.** No init → `[ABORT] posthog not initialized`. Reuse packages, env names, and the server helper. Relocating `instrumentation-client` into the provider is flags bootstrap, not a second integration.
- **`evaluateFlags` once per request.** Never the deprecated per-call methods.
- **Same distinct_id on both sides.** Cookie + request header on the minting request; never a layout `randomUUID()`. After hydration, `posthog.get_distinct_id()` matches `bootstrap.distinctID`.
- **Additive gating.** Flag off (including 0% rollout) = current behavior. Never auth, checkout, or mutations.
- **Off until they turn it on.** Skip = no new flag. Confirm = 0% rollout, never 100%. Abort if create fails.
- **No safe surface is skip, not abort.** The example gate is optional. Finish the SDK install.
- **One `wizard_ask`.** The gate target, and only if a safe surface exists. Skip is first so a stray Enter declines. Nothing else is a question.
- **Env, never hardcode.** A missing token must not crash boot.
- **Don't commit.** The operator reviews the diff.

## Framework guidelines

{commandments}
