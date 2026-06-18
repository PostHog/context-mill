# Running the orchestrator end-to-end in CI

## 1. How Wizard CI works

The trigger lives in the wizard repo:
`wizard-orchestrator/.github/workflows/wizard-ci-trigger.yml`

A PR comment `/wizard-ci <app>` fires `handle-command`, which calls
`POST /repos/PostHog/wizard-workbench/dispatches` with event type
`wizard-ci-trigger` and a `client_payload` containing:

```
app, wizard_ref, context_mill_ref, notify_pr: true, source_pr_number, ...
```

The workbench workflow `wizard-workbench/.github/workflows/wizard-ci.yml` picks
that up, clones and builds wizard + context-mill + MCP in `setup-wizard-deps`,
starts both servers in the background, then runs:

```bash
pnpm wizard-ci --app "$MATRIX_APP" --base "$INPUT_BASE_BRANCH" [--trigger-id ...] [--evaluate]
```

Inside `wizard-ci` (`services/wizard-ci/index.ts`), `runWizard` spawns:

```bash
node dist/bin.js --local-mcp --ci --region us --api-key <key> --install-dir <app>
```

`--local-mcp` tells the wizard to use `http://localhost:8765` (context-mill dev
server) instead of the GitHub releases URL for both skills and agent prompts.

Auth: `POSTHOG_PERSONAL_API_KEY` is the CI bot's PostHog API key (secret
`GH_APP_POSTHOG_WIZARD_CI_BOT_POSTHOG_PERSONAL_KEY`); the wizard uses it for
`--api-key` and the MCP server gets it the same way.

---

## 2. The flag-override path end-to-end

**Step 1 — CI build.**
`setup-wizard-deps/action.yml` (line ~101) runs `pnpm build:ci`, which inlines
`NODE_ENV=ci` into the bundle. That is the guard inside
`applyCiFlagOverrides` (`src/utils/ci-flag-overrides.ts` line 25):

```ts
if (process.env.NODE_ENV === 'production') return flags;
```

Published packages inline `"production"` and the function becomes a no-op.
CI builds do not, so the function is live.

**Step 2 — env var.**
`applyCiFlagOverrides` reads `runtimeEnv('WIZARD_CI_FLAG_OVERRIDES')` at
runtime (registered in `src/env.ts` line 45). It expects a JSON object:
`{"flag-key": value, ...}`. A malformed value throws and kills the run.

**Step 3 — flag eval.**
`getAllFlagsForWizard` in `src/utils/analytics.ts` (line 211) fetches live
flags from PostHog, then unconditionally calls `applyCiFlagOverrides` over
the result (line 241) and caches the merged map. The override wins because it
runs after the network fetch.

**Step 4 — orchestrator gate.**
`isOrchestratorEnabled` in `src/lib/agent/agent-interface.ts` (line 262)
reads `flags['wizard-orchestrator'] === 'true'`. When the override is in the
map, the orchestrator branch fires in `runProgram` regardless of what the live
flag says.

**Does the current CI workflow expose WIZARD_CI_FLAG_OVERRIDES?**

No. Neither `wizard-ci.yml` nor `setup-wizard-deps/action.yml` pass
`WIZARD_CI_FLAG_OVERRIDES` into the `Execute wizard` step. The env block of
that step (`wizard-ci.yml` lines 634–650) does not mention it.

---

## 3. What runs (and doesn't) in CI for the orchestrator

**CI-excluded task types.**
`ciExcludedTaskTypes()` (`src/utils/ci-flag-overrides.ts` line 56) reads
`WIZARD_CI_EXCLUDE_TASKS` (a comma-separated list). The orchestrator runner
(`src/lib/programs/orchestrator/orchestrator-runner.ts` line 93) passes
`{ exclude: ciExcludedTaskTypes() }` to `loadAgentRegistry`. The registry
then drops those types so the seed agent cannot enqueue them.

PR #639 / commit `0a62554` in context-mill says "dashboard is not a CI task".
The `dashboard.md` agent (`transformation-config/agents/dashboard.md`) has no
`ci: false` frontmatter — the exclusion is entirely harness-side via
`WIZARD_CI_EXCLUDE_TASKS=dashboard`. That env var also needs to be set by the
CI workflow (currently missing from the `Execute wizard` env block).

**Agent prompts — the AGENTS_BASE_URL gap.**
`setup-wizard-deps/action.yml` runs `npm run build` for context-mill (line 158)
without setting `AGENTS_BASE_URL`. Inside `scripts/lib/agent-generator.js`
(line 41), `buildAgents` falls back to `DEFAULT_AGENTS_BASE_URL`:

```
https://github.com/PostHog/context-mill/releases/latest/download/agents
```

That URL points to production releases, not to the local dev server. When
context-mill then starts (`npm run dev`) it regenerates `agent-menu.json` with
`http://localhost:8765/agents/…` URLs. But the action only runs `npm run build`
then exports `CONTEXT_MILL_PATH`. The dev server is started later in the
`Run Wizard CI` step via `npm run dev &`. At that point the dev server sets
`AGENTS_BASE_URL = http://localhost:8765/agents` internally (dev-server.js
lines 65–66) and rebuilds, so the in-memory menu is correct.

In practice `--local-mcp` makes the wizard call `http://localhost:8765/agent-menu.json`,
which the running dev server serves with correct localhost URLs — so the agents
are fetched correctly as long as `npm run dev` is running. The skill-menu has
the same pattern. The memory note "must set BOTH SKILLS_BASE_URL + AGENTS_BASE_URL"
applies to manual standalone `npm run build` invocations; CI is fine because it
always goes through the dev server.

**What actually runs.**
All task types in `dist/agents/` are eligible except those in
`WIZARD_CI_EXCLUDE_TASKS`. Currently that env var is never set in CI, so the
seed agent would try to enqueue `dashboard` — which requires MCP write access to
create a PostHog dashboard. Whether that succeeds depends on the CI bot's
PostHog permissions, but it is undesirable for a fast CI loop.

---

## 4. The gap: no way to pass flag overrides via a PR comment

The trigger command `wizard-ci-trigger.yml` accepts only:

```
/wizard-ci <app-or-category>
```

It dispatches a fixed `client_payload` with no `flag_overrides` or
`ci_flag_overrides` field. The workbench `wizard-ci.yml` `resolve-inputs` step
does not read any such field from `client_payload`. There is no path from a PR
comment to `WIZARD_CI_FLAG_OVERRIDES` in the execute-wizard env.

---

## 5. Concrete recommendation

### Option A — add flag-override plumbing (recommended, ~1 day)

Two files need changes.

**wizard-workbench/.github/workflows/wizard-ci.yml**

1. Add `flag_overrides` to `workflow_dispatch` inputs (type: string, default: '').
2. In `resolve-inputs`: read `CP_FLAG_OVERRIDES` / `INPUT_FLAG_OVERRIDES` and
   emit `flag_overrides` output (same pattern as the other inputs).
3. Pass it as `input_flag_overrides` through `discover` outputs.
4. In the `Execute wizard` env block (line 634), add:
   ```yaml
   WIZARD_CI_FLAG_OVERRIDES: ${{ needs.discover.outputs.input_flag_overrides }}
   WIZARD_CI_EXCLUDE_TASKS: dashboard
   ```

**wizard-orchestrator/.github/workflows/wizard-ci-trigger.yml**

In `handle-command`, add `flag_overrides` to the `client_payload`:
```js
const overridesMatch = comment.match(/--flags\s+(\S+)/);
flag_overrides: overridesMatch ? overridesMatch[1] : ''
```

This lets a PR comment like:
```
/wizard-ci basic-integration/next-js/15-app-router-saas --flags {"wizard-orchestrator":true}
```
route `WIZARD_CI_FLAG_OVERRIDES={"wizard-orchestrator":true}` into the wizard binary.

### Option B — trigger via workflow_dispatch now (no code change needed)

Go to `wizard-workbench` → Actions → "Wizard CI" → Run workflow, and set:
- `app`: e.g. `basic-integration/next-js/15-app-router-saas`
- `wizard_ref`: `experiment/orchestrator-run-cache`
- `context_mill_ref`: `experiment/orchestrator`

Then add `WIZARD_CI_FLAG_OVERRIDES` and `WIZARD_CI_EXCLUDE_TASKS` as manual
additions to the env block — but since the current workflow has no `flag_overrides`
input, you can't pass it this way without editing the yaml first.

**Short-term workaround (no workflow edits):** add a temporary `env:` override
directly in the `Execute wizard` step of `wizard-ci.yml` on a branch:

```yaml
WIZARD_CI_FLAG_OVERRIDES: '{"wizard-orchestrator":true}'
WIZARD_CI_EXCLUDE_TASKS: dashboard
```

Then trigger CI via workflow_dispatch with `wizard_ref: experiment/orchestrator-run-cache`
and `context_mill_ref: experiment/orchestrator`. That is a single-line change, safe
to push to a short-lived branch of wizard-workbench without merging.

---

## Summary of env vars needed in the Execute wizard step

| Var | Value | Status |
|-----|-------|--------|
| `WIZARD_CI_FLAG_OVERRIDES` | `{"wizard-orchestrator":true}` | **missing** |
| `WIZARD_CI_EXCLUDE_TASKS` | `dashboard` | **missing** |
| `POSTHOG_PERSONAL_API_KEY` | bot secret | already wired |
| `WIZARD_PATH` | `~/wizard` | already wired |
| `CONTEXT_MILL_PATH` | `~/context-mill` | already wired |
| `MCP_PATH` | `~/posthog/services/mcp` | already wired |

The two missing vars are the only change needed to make the orchestrator path
run end-to-end in CI.
