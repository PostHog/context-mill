# Add PostHog feature flags (Next.js App Router)

Use this skill to give a Next.js App Router app a **correct, cheap** feature-flag install: server-side evaluation bootstrapped into the client, one real flag in the user's PostHog project, one gated UI path, and CI configured so forgotten test environments don't poll `/flags`.

This is **not** `wizard audit feature-flags` (read-only, after the fact) and **not** the default `wizard` install (product analytics; its prompt explicitly excludes the feature-flags category). This is the missing expert first hour.

## Scope — one stack, one pattern

**Supported: Next.js App Router only** (`app/` directory, `next` in `package.json`).

If the project is Pages Router, a different framework, or a backend-only package, **stop**: emit `[ABORT] unsupported stack — currently Next.js App Router only` on its own line and do nothing else. Do not invent a second pattern. Do not "also support" middleware-only, local evaluation, or `@posthog/next` (pre-release).

**The pattern (do this, nothing else):**

1. Evaluate flags **once per request** on the server with `posthog-node`'s `evaluateFlags()`.
2. Pass those values + the same `distinct_id` into the client via `bootstrap` on `PostHogProvider`.
3. Gate UI with `useFeatureFlagEnabled` from `@posthog/react`.
4. Create **one** boolean flag at 100% rollout and gate **one** additive UI path after the user confirms.

This avoids flicker (the client has values on first paint) and a duplicate `/flags` request on init. It also avoids local evaluation, whose default 30s poll costs an idle server ~864k requests/month (see `cutting-costs.md`).

## Abort cases

If anything blocks the run, **always** emit exactly one `[ABORT] <reason>` line and stop. The wizard catches `[ABORT]` and terminates the run; don't try to exit yourself. Use one of:

- `[ABORT] unsupported stack — currently Next.js App Router only` — no `app/` directory, or `next` is not a dependency.
- `[ABORT] could not locate a UI surface to gate` — exhaustive search found no page or component safe to add an additive, flag-gated element to.
- `[ABORT] no posthog project credentials` — no `phc_…` token in env and no PostHog MCP available to fetch one.
- `[ABORT] <short specific reason>` — anything else that blocks (unreadable project, MCP flag-create failed after retry). Keep it short.

## Tools

{{> mcp-tool-calling}}

Wizard tools (when running inside the wizard):

- `mcp__wizard-tools__wizard_ask` — the **only** way to ask the user which UI path to gate. Call it **exactly once**. Do not ask via chat.
- `mcp__wizard-tools__check_env_keys` / `mcp__wizard-tools__set_env_values` — env keys. Never hardcode the project token.

PostHog MCP (via `exec`): `create-feature-flag`, `feature-flag-get-definition-by-key`, `projects-get`, `execute-sql` (to confirm `$feature_flag_called`). Always `info` before `call`.

## Instructions

Follow these steps IN ORDER. Emit `[STATUS] <short phrase>` at the start of each step.

### STEP 1: Confirm Next.js App Router

Look for `next` in `package.json` **and** an `app/` directory (or `src/app/`). Lockfile decides the package manager (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`).

If this is not Next.js App Router, apply the unsupported-stack abort.

Record: package manager, whether `src/` is used, whether PostHog is already initialized (`posthog.init`, `PostHogProvider`, `instrumentation-client`, `posthog-js` / `posthog-node` in dependencies).

### STEP 2: Credentials

- If `.env` / `.env.local` already has a `phc_…` token and a host, reuse those keys (don't rename working names).
- Otherwise use `projects-get` to fetch `api_token`. If several projects come back, pick the one the wizard session is already authenticated to; if that's unclear, abort with `no posthog project credentials` rather than guessing.
- Host: `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU). Match the project's region from `projects-get`.
- Write `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` via `set_env_values` if missing. Never hardcode.

### STEP 3: Install packages

Install, with the project's package manager:

- `posthog-js` — client
- `posthog-node` — server evaluation
- `@posthog/react` — `useFeatureFlagEnabled` / `PostHogProvider`

Do not install `@posthog/next` (pre-release). Do not install extra OTel or analytics packages.

If they're already present, leave the versions alone unless they're so old that `evaluateFlags` doesn't exist — then bump `posthog-node` only.

### STEP 4: Server client + `evaluateFlags`

Add a small server helper (e.g. `lib/posthog-server.ts` or `app/posthog.ts` — match the project's folder style):

```ts
import { PostHog } from 'posthog-node'

export function PostHogServer() {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  })
}
```

`flushAt: 1` / `flushInterval: 0` is required in Next.js server functions — they freeze before a batched flush lands. Always `await client.shutdown()` after evaluating.

**Use `evaluateFlags()`, not the deprecated `getFeatureFlag` / `isFeatureEnabled` / `getAllFlags`.** One `evaluateFlags(distinctId)` call is one `/flags` request; then read with `flags.isEnabled(key)` / `flags.getFlag(key)`. Calling the old methods once each is the billing footgun this program exists to prevent.

```ts
const client = PostHogServer()
const flags = await client.evaluateFlags(distinctId)
const enabled = flags.isEnabled(flagKey) === true
await client.shutdown()
// Bootstrap at least the flag we created. If the snapshot exposes an
// enumerable map of all evaluated flags, pass that instead so the client
// is fully seeded — one /flags round-trip, no client refetch on init.
const featureFlags = { [flagKey]: enabled }
```

If you can only bootstrap the one flag, say so in the report (hack). Never call `getFeatureFlag` / `isFeatureEnabled` / `getAllFlags` — those are deprecated and each one is its own `/flags` request.

### STEP 5: Distinct ID that matches on server and client

Percentage rollout is deterministic per `distinct_id`. Server and client **must** use the same one.

- **If the app already identifies users** (`posthog.identify`, next-auth session id, etc.): use that stable id on the server and bootstrap `distinctID` + `isIdentifiedID: true`.
- **If there is no auth** (typical of wizard-workbench apps): set a cookie (e.g. `ph_distinct_id`) in the root layout or a tiny helper, reuse it on both sides, bootstrap `distinctID` with `isIdentifiedID: false`. **This is a hack.** Call it out in the report. Do not invent `identify('anonymous')`.

Do not introduce local evaluation.

### STEP 6: Client provider with bootstrap

Add a client provider (e.g. `app/providers.tsx`) and wrap `{children}` from the root layout.

The root layout (a Server Component) evaluates flags, then passes them in:

```tsx
'use client'
import { PostHogProvider } from 'posthog-js/react'

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
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true'
  return (
    <PostHogProvider
      apiKey={process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!}
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

`advanced_disable_feature_flags: true` in test/CI is the cutting-costs default: CI pipelines silently accumulate `/flags` requests otherwise.

**If `instrumentation-client.ts` (or `.js`) already inits `posthog-js`:** relocate that init into this provider so bootstrap can be passed per request. Keep the existing `api_host` / `defaults` / other options — this is a move, not a rewrite of analytics behavior. Don't leave both inits in place (double-init is worse than relocating).

**If there is no existing client init:** the provider is the only client init. Do not also add `instrumentation-client.ts`.

### STEP 7: Create one real flag

Search existing flags (`feature-flag-get-definition-by-key` or list) for a key matching the feature you plan to gate. Reuse it if it's a boolean flag. Otherwise create one:

- key: kebab-case, descriptive (`new-todo-empty-state`, `show-about-banner`)
- type: **boolean** (not multivariate — that's a Learn-card concept, not this demo)
- active: true
- rollout: **100%** (deterministic. Targeting/phased rollout are taught, not made flaky here)
- name: one sentence saying the wizard created it and which UI path it gates

Use `create-feature-flag` via `exec`. If create fails, retry once after `info`; then abort with a specific reason.

### STEP 8: Confirm the gate target — exactly one `wizard_ask`

Flags break real production UI. Ask **once**, then gate only what they picked.

1. Scan pages/components for **additive** surfaces (a banner, an extra card, a "new" empty-state illustration). Prefer new elements over wrapping existing critical logic.
2. **Never** propose gating auth, checkout, payments, data-mutation handlers, or middleware that could 404 a route.
3. Call `mcp__wizard-tools__wizard_ask` **exactly once**:
   - `subject`: `"gate-target"`
   - one `kind: "select"` question
   - `prompt`: explain you're about to gate one UI path with the flag you created, flag-off = current behavior, and they should pick a low-risk additive target.
   - `options`: the **recommended** additive target first (label includes "recommended"), then 1–2 alternatives, then a last option `{ label: "Skip gating — install only", value: "skip" }`.
4. If `wizard_ask` errors (CI / headless): do **not** fail. Gate the recommended additive target and record "auto-picked (no TTY)" in the report.
5. If they pick `skip`: still leave the install + flag in place; write the report saying no UI was gated.

Do not ask any other question. Credentials come from MCP/env, not from the user.

### STEP 9: Gate the chosen path

Additive only. Flag off = current behavior.

```tsx
'use client'
import { useFeatureFlagEnabled } from '@posthog/react'

export function FlaggedBanner() {
  const enabled = useFeatureFlagEnabled('<flag-key>', false)
  if (!enabled) return null
  return <aside>New: this banner is gated by <code>&lt;flag-key&gt;</code>.</aside>
}
```

Pass `false` as the default so the type is `boolean` and the banner stays hidden while flags load (no flicker of the new element).

Do not restructure the file. Read it immediately before editing it.

### STEP 10: Verify

1. Typecheck / lint the files you touched (`tsc --noEmit` or the project's `build` if that's the only check). Fix errors you introduced.
2. From a short server-side snippet or the helper you added: `evaluateFlags(distinctId)` → `flags.isEnabled(flagKey)` should be `true` at 100% rollout. `await client.shutdown()`.
3. Query `$feature_flag_called` via `execute-sql` for that flag key in the last 15 minutes. If the event hasn't landed yet, say so in the report (ingestion can lag ~1 minute) — that's a warning, not an abort.

### STEP 11: Report

Write `posthog-feature-flags-report.md` at the project root covering:

- Stack detected, pattern used (server `evaluateFlags` → client bootstrap)
- Packages added, files changed
- Flag key + PostHog URL
- Which UI path was gated (or skipped) and why it was additive
- Bill-aware defaults applied (`evaluateFlags` once per request, CI `advanced_disable_feature_flags`, no local evaluation)
- **Hacks acknowledged** — cookie distinct_id, relocated `instrumentation-client` init, bootstrap of one flag rather than the full snapshot, auto-picked gate target in CI, anything else you did that isn't the general case
- How to demo the kill-switch: disable the flag in PostHog → reload → gated UI disappears
- What this did *not* do (local evaluation, experiments, multivariate, other frameworks)

## Key principles

- **One stack, one pattern.** Next.js App Router + server eval + bootstrap. Everything else aborts.
- **`evaluateFlags` once per request.** Never the deprecated per-call methods.
- **Same distinct_id on both sides.** Otherwise bootstrap lies.
- **Additive gating.** Flag off = current behavior. Never auth/checkout/mutations.
- **One `wizard_ask`.** The gate target. Nothing else.
- **Env, never hardcode.**
- **Don't commit.** The operator reviews the diff.
- **Ack the hacks** in the report instead of generalizing the skill to hide them.

## Reference files

{references}

`libraries/next-js.md` is the Next.js SDK source of truth (App Router server client, env names). `bootstrapping.md` is the source of truth for `bootstrap.featureFlags` + matching `distinctID`. `cutting-costs.md` is why we disable flags in CI and refuse local evaluation as the default. `adding-feature-flag-code.md` is the source of truth for `evaluateFlags` / `useFeatureFlagEnabled`. `start-here.md` is the product overview.

## Framework guidelines

{commandments}
