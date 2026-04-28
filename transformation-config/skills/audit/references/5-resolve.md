# Step 5 — Resolve `init-correct`

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

This step has exactly one action: evaluate `init-correct` against the evidence already in your reasoning, then `Write` the updated ledger.

**No new Reads, Greps, Globs, or Bash searches in this step.** Every rule below is evaluated against the manifests (Step 2), init-site files (Step 3), and bounded config set (Step 4).

## TodoWrite

First, update the in-progress task's `activeForm` to `Resolving installation checks`. Status and content stay the same.

Then, after the ledger Write below succeeds, mark `Audit installation & setup` as `completed` and `Audit identification logic` as `in_progress` with `activeForm: "Auditing user identification"`.

## Action

`Write` `.posthog-audit-checks.json` with `init-correct` resolved. The other two entries from Step 2 stay as you wrote them.

### Resolution rules for `init-correct`

If a rule's evidence is not in the gathered set, treat the rule as **not applicable** and leave it out of `details` — do **not** widen the scan.

- `pass`: matches framework rules.
- `error`: SDK installed but no init call exists anywhere.
- `error`: API key hardcoded in init-site source instead of read from an env var.
- `error`: `phx_` personal API key visible in init-site source or `.env*`.
- `warning`: Init not global / called inside a component re-render or per-request handler (visible at the init site).
- `warning`: Next.js ≥ 15.3 (per `package.json`) without `instrumentation-client.ts` among init-site hits.
- `warning`: Server-side SDK in manifest is missing while the manifest also declares a server framework (Next.js / Express / Fastify / NestJS / etc.).
- `warning`: Short-lived process runtime (CLI, serverless, script, Django management command) detectable from the init-site file or `package.json` without `posthog.shutdown()` / `flush()` near exit in that file.
- `suggestion`: Browser SDK present and the framework config file does not configure a reverse proxy / rewrite to `*.posthog.com`.

Apply only the framework-specific rules from the best-practices skill whose evidence is in the gathered set: React (init global, no effect-driven inference), TanStack (provider in root route, `posthog-node` singleton in `src/routes/api/`), SvelteKit (`svelte-autofixer`), Astro (`is:inline`, `PUBLIC_` prefix), Angular (singleton root service via `inject()`, `environment.ts`), React Native / Expo (provider placement for `NavigationContainer` / `expo-router`, env via `react-native-config` or `expo-constants`), Python (`Posthog()` instance API, `set()` over `identify()` for context, `atexit.register(posthog.shutdown)` for scripts), Django (`PosthogContextMiddleware`, `AppConfig.ready()` init), Flask (init in `create_app()` before blueprint registration), FastAPI (lifespan startup/shutdown), Ruby/Rails (`posthog-rails` initializer, autocapture not recreated), PHP/Laravel (init once, associative arrays, `config/posthog.php`), Swift (`POSTHOG_PROJECT_TOKEN` from scheme env, sandbox outgoing network), Android (`PostHogAndroid.setup()` once in `Application.onCreate()`, `android:label` per activity).

## Status

Status to report in this phase:

- Resolving installation checks
- Found [N] installation issues ([X] errors, [Y] warnings, [Z] suggestions)

---

**Upon completion, continue with:** [6-identify-seed.md](6-identify-seed.md)
