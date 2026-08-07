# Feature Flags Doctor — Checks

Read this file when Phase 1 begins — not before. The `prompt-ff-*.md` files referenced below are subagent prompts: each dispatched subagent reads exactly its own, and the main loop never reads any of them.

Two groups. **Static checks** read the source tree only and run first, as parallel subagents. **Live checks** run second, from the main loop (no subagents): they probe the project's real `/flags` endpoint and read the flag roster via MCP. Severity values are **fixed** — do not adjust them. Resolve every check via `mcp__wizard-tools__audit_resolve_checks` (skip ids missing from the ledger); append per-flag findings via `mcp__wizard-tools__audit_add_checks` exactly as each sweep section specifies.

Every check is independent and required. A failure in one does not block the others. Do not invent checks beyond the ones listed.

---

## Part 1 — Static checks (parallel subagents)

Emit `[STATUS] Auditing feature flag correctness`, then make **six `Agent` tool calls in a single message** for the correctness checks (Tasks A–F). When all six return, emit `[STATUS] Auditing feature flag cost optimization` and dispatch the cost checks (Tasks G–I) the same way — one `Agent` call per check that actually runs, in a single message. Tasks G and H are gated on the pre-flight local-evaluation signal; for a gated task that is skipping, emit its `audit_resolve_checks` update directly (`status: "pass"`, `details: "skip: local evaluation not detected"`) instead of dispatching a subagent.

### Dispatch table

| Task | Check id | Prompt file | Gating |
| --- | --- | --- | --- |
| A | `ff-bootstrap-when-known-set` | `prompt-ff-bootstrap-when-known-set.md` | — |
| B | `ff-await-readiness` | `prompt-ff-await-readiness.md` | — |
| C | `ff-default-values` | `prompt-ff-default-values.md` | — |
| D | `ff-bootstrap-distinct-id-mismatch` | `prompt-ff-bootstrap-distinct-id-mismatch.md` | — |
| E | `ff-identified-only-pre-auth-targeting` | `prompt-ff-identified-only-pre-auth-targeting.md` | — |
| F | `ff-eval-before-identify` | `prompt-ff-eval-before-identify.md` | — |
| G | `ff-local-eval-polling-interval` | `prompt-ff-local-eval-polling-interval.md` | skip unless local evaluation detected |
| H | `ff-local-eval-in-edge-handlers` | `prompt-ff-local-eval-in-edge-handlers.md` | skip unless local evaluation detected |
| I | `ff-test-ci-gating` | `prompt-ff-test-ci-gating.md` | — |

### Dispatch shape — identical for every task

Each `Agent` call sets:

- `description`: `Audit <check-id>`
- `prompt` — this template verbatim, substituting `<check-id>` and `<prompt-file>` from the table:

````
You are an audit subagent. Resolve exactly one rule and return: <check-id>.

Read this skill's bundled `<prompt-file>` reference once (typically `.claude/skills/audit-feature-flags/references/<prompt-file>`; otherwise discover it with `Glob` `**/skills/audit-feature-flags/references/<prompt-file>`) and follow its instructions exactly. Emit the single `mcp__wizard-tools__audit_resolve_checks` call it specifies, then return. Do not write the audit report.
````

Do not paste a prompt file's contents into the dispatch prompt — the subagent loads its own. The prompt files direct each subagent to the bundled doc (`best-practices.md`, `bootstrapping.md`, or `cutting-costs.md`) that holds PostHog's authoritative guidance for its rule.

---

## Part 2 — Live checks (main loop, sequential)

These run after the static fan-out returns. They need two inputs; establish both up front:

**The project token and host.** Prefer the values the wizard passed in the run context (project API key `phc_…` and API host). Otherwise: `mcp__wizard-tools__check_env_keys` to learn which env keys exist, then Grep/Read the init site to find how the token and `api_host` are wired (the token is a public client value; personal API keys are never used here). Record BOTH hosts when they differ: the **app path** (what the SDK is configured to use — often a first-party proxy like `/ingest` on the app's own domain) and the **direct cloud host** (`https://us.i.posthog.com` or `https://eu.i.posthog.com` by region).

**The flag roster.** List the project's flags via `feature-flag-get-all` (or the equivalent MCP listing tool). Fallback if only SQL is available:

```sql
SELECT key, active, filters
FROM feature_flags
WHERE deleted = false
```

If the roster call fails with a permissions error, emit `[ABORT] Insufficient permissions`. If the MCP server is simply unavailable, resolve the roster-dependent comparisons (`ff-flags-delivered`, `ff-unknown-flags`, `ff-stale-rolled-out`, `ff-active-but-unreferenced`) as `suggestion` with `details: {"mcp_skipped": true, "reason": "PostHog MCP unavailable"}`.

**MCP loss degrades ONLY the roster comparisons — nothing else.** Every check below that runs on probes or greps MUST still execute in full when MCP is down: Check J (`ff-key-authenticates` — curl only), Check K (`ff-flags-endpoint` — curl only), Check M's code-key collection (grep only; record the keys in `details` even when the roster comparison is skipped), and Check N's code signal (`ff-evaluated-not-reported` — grep only; a `send_event: false` suppression is a full-strength warning with or without the data signal, and it still sets `gates_cleanup: true`). Resolve every check individually; never batch-skip the live phase because one dependency failed.

### The probe (used by Checks J, K, and L)

Emit `[STATUS] Probing /flags delivery`. One plain curl per target host — **the User-Agent matters** (tenet 4): PostHog's server filters clients whose UA looks automated (contains `HeadlessChrome`, `bot`, crawler names, etc.) and returns `{"errorsWhileComputingFlags": false, "flags": {}}` with HTTP 200 for them. That is expected product behavior, and it means a probe with a default curl-adjacent or headless UA manufactures a false failure. Always send a realistic browser UA:

```
curl -s -X POST "<host>/flags/?v=2" \
  -H "Content-Type: application/json" \
  -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -d '{"api_key": "<project token>", "distinct_id": "ff-doctor-probe"}'
```

Run it once against the direct cloud host and — when the app is configured with a different `api_host` — once against the app path (e.g. `https://app.example.com/ingest/flags/?v=2`). Keep both raw responses in memory for the checks below. Do not retry more than once per host.

### Check J — `ff-key-authenticates`

What it verifies: the token the app actually ships **authenticates**. Static analysis can see an env var referenced; it cannot know the value works — or that the env file is even populated (an empty `.env` fails silently: the SDK inits, nothing ever arrives).

Classify the direct-host probe:
- HTTP 200 with a JSON body (flags present or legitimately empty) → the key authenticates.
- HTTP 401 / 403, or a body with an authentication error → the key is wrong or revoked.
- No token found anywhere in env or code → the key is not wired at all.

Rule:
- pass: 200 with valid JSON.
- error: 401/403/auth error — the app cannot receive flags with this key.
- error: no token wired — the SDK initializes with nothing; flags silently never load. (`file`: the init site expecting the env var.)
- error: a **personal API key** (`phx_…` pattern, or an env var named like `POSTHOG_PERSONAL_API_KEY`) is referenced in client-side code or a client bundle path — personal keys grant account access and must never ship to browsers; flags client-side use the public project key. (`file`: the offending reference. Report the variable name only, never the value.)
- suggestion: probe could not run (no network / no token discoverable AND wizard context absent) — `details` explains.

`details` (compact JSON): `{"status_code": <N>, "host": "<direct host>", "token_source": "wizard-context | env | code | missing"}`. Never include the token value.

### Check K — `ff-flags-endpoint`

What it verifies: the **path the app actually uses** serves flags. Projects using a first-party reverse proxy (`api_host: "/ingest"` etc.) can break the flags route in the proxy rewrite while everything else looks fine — a class of silent failure the static audit cannot see.

Only meaningful when the app path differs from the direct host; if the app talks to PostHog Cloud directly, resolve `pass` with `details: "app uses the direct PostHog host"`.

Compare the two probe responses:
- Both 200 with the same flag keys → pass.
- Direct host healthy but the app path errors (non-200, HTML error page, timeout) → **error**: the proxy route is broken; every client behind it silently gets no flags.
- Direct host healthy but the app path returns 200 with a *different* (e.g. empty) flag set → **warning**: something between the app and PostHog is altering the response.

`details`: `{"direct_status": <N>, "proxy_status": <N>, "direct_flag_count": <N>, "proxy_flag_count": <N>, "proxy_host": "<host/path>"}`.

Emit `[STATUS] Cross-checking delivered flags against definitions` before the next check.

### Check L — `ff-flags-delivered` (sweep)

What it verifies: every **active** flag in the roster actually appears in the probe response, and what each evaluates to. `/flags?v=2` returns a per-flag `reason` (e.g. `condition_match`, `out_of_rollout_bound`) — surface it: it converts "my flag isn't working" from a mystery into a stated cause.

Compare roster (active, non-deleted flags) against the app-path probe response (fall back to the direct response if there is no proxy):

- Every active flag present in the response → resolve `ff-flags-delivered` as `pass` with `details: {"active_flag_count": <N>, "delivered_count": <N>}`.
- One or more active flags missing from the response, or present with a surprising evaluation → resolve `ff-flags-delivered` as `warning` with the counts, AND append one row per affected flag via a single `audit_add_checks` call:
  - `id`: `delivered-<flag-key>` (kebab-case; append `-2` on collision — a duplicate id rejects the whole batch; never call with an empty array).
  - `area`: `Feature Flags — Delivery`.
  - `label`: `<flag-key> not delivered` (≤40 chars, no trailing period).
  - `status`: `warning`, `file`: omit.
  - `details`: one line — what the roster says vs what the probe returned, including the `reason` code when present.

Report copy note (teaching callout, NOT a finding): if the operator's own verification method is an automated browser (Playwright/Cypress/headless), remind them in the report's "Notes on expected behavior" section that such clients intentionally receive zero flags — with the docs link — because that is the single most common false alarm when people test flags.

### Check M — `ff-unknown-flags` (sweep)

Emit `[STATUS] Checking flag keys referenced in code exist in PostHog`.

What it verifies: the **reverse direction** — every flag key referenced in code exists in the roster. A typo'd or deleted key returns `undefined` on every evaluation, forever, with no error anywhere. Check P covers tenant→code (unreferenced flags); this is code→tenant, and nothing else covers it.

Collect the set of flag keys used in code: Grep flag-eval call sites (`getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|getFeatureFlagPayload\(`) and extract the first string-literal argument of each call. Keys built dynamically (template strings, variables) are recorded as `dynamic` and excluded from the comparison (note the count in `details`).

Compare against the roster (all non-deleted flags, active or not):
- Every literal key exists in the roster → resolve `ff-unknown-flags` as `pass` with `details: {"code_key_count": <N>, "dynamic_key_count": <N>}`.
- One or more keys missing → resolve `ff-unknown-flags` as `error` with the counts, AND append one row per ghost key via a single `audit_add_checks` call:
  - `id`: `ghost-<flag-key>`, `area`: `Feature Flags — Delivery`, `label`: `<flag-key> not found in PostHog` (≤40 chars), `status`: `error`, `file`: the `path:line` of the call site, `details`: one line naming the nearest-matching roster key if one exists (likely typo) or `no similar flag — deleted or never created`.

### Check N — `ff-evaluated-not-reported`

Emit `[STATUS] Verifying evaluation events are reported`.

What it verifies: flags being **evaluated** and evaluations being **reported** are different things. SDKs report evaluations via `$feature_flag_called` events; PostHog uses those events for experiment exposure AND for flag staleness ("not evaluated in 30+ days"). A project that evaluates flags but suppresses these events breaks its experiments silently — and makes every used flag look stale, which is why this check gates cleanup (tenet 2).

Two signals, either sufficient for a finding:

1. **Code signal:** Grep for `send_feature_flag_events|sendFeatureFlagEvents|sendFeatureFlagEvent|advanced_disable_feature_flags|send_event\s*:\s*false|sendEvent\s*:\s*false` and read each hit. Two suppression forms count: config-level (an init/config option that disables flag-called events) and per-call (posthog-js `isFeatureEnabled('key', { send_event: false })` / `getFeatureFlag(..., { send_event: false })`). A suppression in production paths (not test/CI-gated blocks — those are the correct pattern from Task I) is a finding; per-call suppressions matter per flag — a single suppressed flag is enough to make THAT flag look stale.
2. **Data signal (when MCP query access is available):** count recent `$feature_flag_called` events:

```sql
SELECT count() AS calls
FROM events
WHERE event = '$feature_flag_called'
  AND timestamp > now() - INTERVAL 7 DAY
```

Rule:
- pass: no production-path suppression in code AND (query unavailable OR calls > 0 OR the project has no production traffic yet — do not fail a brand-new project on zero events alone; record `details: "no traffic baseline"`).
- warning: code suppresses `$feature_flag_called` in production paths, OR the project has flag call sites and recent traffic but zero `$feature_flag_called` events in 7 days.
- error: suppression is unconditional AND the roster shows flags used in experiments (roster `filters`/experiment linkage) — experiment exposure is silently broken.

`details` (compact JSON): `{"suppression_sites": [{"file": "<path:line>"}], "calls_7d": <N or null>, "gates_cleanup": true | false}` — set `gates_cleanup: true` whenever status is warning/error; Phase 2 reads this to withhold tenant-side cleanup options.

### Check O — `ff-stale-rolled-out` (sweep)

What it verifies: flags at **100% rollout with no conditions** that are still gated in code — the check is equivalent to a hardcoded value: dead branches, needless evaluations, cleanup candidates. (The tenant-side twin, zero-reference active flags, is Check P below — `ff-active-but-unreferenced`.)

From the roster, select active flags whose filters release to 100% with no property/cohort conditions and no experiment linkage. Intersect with the code-key set from Check M (flags that ARE referenced).

- None → resolve `ff-stale-rolled-out` as `pass`.
- One or more → resolve as `suggestion` with counts, AND append one row per flag via a single `audit_add_checks` call: `id`: `stale-<flag-key>`, `area`: `Feature Flags — Optimize`, `label`: `<flag-key> at 100% but still gated` (≤40 chars), `status`: `suggestion`, `file`: a representative call site, `details`: one line — rollout state + reference count + "safe order: remove the gate, deploy, then disable in PostHog".

**Interlock note:** when `ff-evaluated-not-reported` has `gates_cleanup: true`, these rows still appear (they're real observations) but their fixes are withheld in Phase 2 and the report explains why.

### Check P — `ff-active-but-unreferenced`

What it verifies: the tenant→code direction of drift — **active** flags with zero references anywhere in the source tree. Per the cutting-costs guidance: active flags continue to evaluate (and bill) even with zero code references, because survey targeting and the `/flags` endpoint evaluate all active flags. The only way to stop the charges is to disable, archive, or delete the flag in PostHog — removing it from code is not enough.

Using the roster (active flags) and the code-key set from Check M: for each active flag key with zero literal references, grep once more for the literal key across the whole tree (any file counts — config, test fixture, comment) to rule out non-eval references before flagging.

Rule:
- pass: every active flag has at least one reference in the codebase.
- suggestion: 1+ active flags have zero references — still evaluated (and billed) on every `/flags` request. Recommend disabling, archiving, or deleting them in PostHog.

Resolve `ff-active-but-unreferenced` with `file` omitted (project-wide) and `details` as compact JSON:

```
{
  "active_flag_count": <N>,
  "unreferenced_active_flag_count": <N>,
  "unreferenced_keys": ["<key>", ...],
  "mcp_skipped": false
}
```

**Interlock note:** archive fixes for these flags are the ones most directly gated by `ff-evaluated-not-reported` — "zero code references" and "zero evaluation events" are only trustworthy together when evaluation reporting is verified working.
