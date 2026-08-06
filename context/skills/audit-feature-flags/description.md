# PostHog Feature Flags Doctor

This skill checks an existing PostHog project's **feature flags** end to end and fixes the problems the user chooses. It goes beyond static analysis: it verifies flags are actually **delivered** to the app by probing the same `/flags` endpoint the SDK uses, cross-checks the response against the flag definitions in PostHog, and diagnoses the silent failure modes static analysis cannot see. It works in three phases:

1. **Verify (read-only):** static correctness and cost checks over the source tree, plus live delivery and observability checks against the project's real `/flags` endpoint and flag roster.
2. **Confirm:** present the findings and let the user pick which ones to fix — a single `wizard_ask` multi-select.
3. **Fix:** apply only the selected fixes — to the user's code and/or their PostHog project via the MCP — then write a report.

The verify phase never changes anything. Changes happen only in the fix phase, and only for findings the user explicitly selected. Output: a markdown report at `posthog-feature-flags-report.md` at the project root.

## Reference files

{references}

## Guiding tenets

1. **Consent-gated changes.** The verify phase is read-only. In the fix phase, change only what the user selected in the `wizard_ask` step — never touch a finding they didn't pick, and never make a change beyond the remediation mapped for that finding in `references/remediation.md`.

2. **The cleanup interlock.** PostHog measures flag staleness by `$feature_flag_called` events. If this project evaluates flags but does not send those events (`ff-evaluated-not-reported` resolves as a finding), a flag in heavy production use is indistinguishable from a dead one. In that state, NEVER offer archive/disable fixes for tenant-side flags — offer only the fix that restores evaluation reporting, and record the cleanup candidates under "Manual follow-up" with an explanation. This is the most important correctness rule in this skill.

3. **Evidence-based.** Every non-pass finding cites `file:line` for code findings, or the probe request/response facts (status code, flag counts, `reason` codes) for live findings. Never fabricate or estimate; report only what greps, probes, and MCP calls actually returned.

4. **Expected behavior is taught, not reported.** PostHog intentionally filters automated clients (headless browsers, crawlers) from `/flags` — such clients receive `{"errorsWhileComputingFlags": false, "flags": {}}` by design. This is a teaching callout in the report, never a finding. It also constrains the doctor itself: **every `/flags` probe must send a realistic browser User-Agent** (see `references/checks.md`), or the probe manufactures a false failure.

5. **Secrets stay secret.** The project API key (`phc_…`) is a public client token and may be used in probe commands, but never paste personal API keys (`phx_…`) into commands, details, or the report. Never edit `.env` directly — use the wizard-tools MCP (`check_env_keys` / `set_env_values`) for environment values. Never include tokens or PII in the report.

6. **Ledger contract.** When run by the wizard's native program, the audit ledger is pre-seeded — patch rows with `mcp__wizard-tools__audit_resolve_checks` and append sweep rows with `mcp__wizard-tools__audit_add_checks`. NEVER call `audit_seed_checks` (it atomically replaces the ledger and wipes the seeded rows). Every ledger call gracefully handles a missing check id: if an expected id is not in the ledger, skip its resolve call and continue — the run may be a plain skill run with no ledger at all.

## Available tools

{{> mcp-tool-calling}}

**Verify (read-only):**
- `Glob` / `Grep` / `Read` — static checks over the source tree.
- `Bash` (plain `curl` only) — live `/flags` probes. Keep probe commands minimal and legible; see `references/checks.md` for the exact shapes.
- `feature-flag-get-all` (or the equivalent MCP flag-listing tool; `execute-sql` fallback) — the project's flag roster.
- `mcp__wizard-tools__check_env_keys` — which env keys exist (never reveals values).
- `docs-search` — latest doc URLs for remediation links.

**Confirm:**
- `mcp__wizard-tools__wizard_ask` — ask which findings to fix. Call it **once** with a single multi-select question (see Phase 2).

**Fix:**
- `Read` and `Edit` — apply code fixes. Always Read a file immediately before editing it.
- The MCP flag-mutation tool (e.g. `feature-flag-update` or equivalent) — archive/disable flags the user selected. If no such tool is available, do NOT guess a tool name: record the fix as manual guidance instead.
- `mcp__wizard-tools__set_env_values` — environment fixes.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Emit one whenever you start a new sub-step:

```
[STATUS] Probing /flags delivery
```

The full list of expected `[STATUS]` lines is in the Status section below and per-check in `references/checks.md`.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and renders live in the wizard's "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch checks by `id`: `{ id, status, file?, details? }`. Batch updates from the same step into one call. Errors on unknown ids — skip ids that aren't in the ledger.
- `mcp__wizard-tools__audit_add_checks({ checks })` — append sweep rows (per-flag findings that can't be enumerated at seed time). Never call it with an empty array (rejected). Prefix appended ids (`delivered-`, `ghost-`, `stale-`) and de-duplicate — one duplicate id rejects the whole batch.

Seeded check ids (the wizard's native program seeds these; a plain skill run may have none): `ff-presence`, `ff-key-authenticates`, `ff-flags-endpoint`, `ff-flags-delivered`, `ff-unknown-flags`, `ff-evaluated-not-reported`, `ff-bootstrap-when-known-set`, `ff-await-readiness`, `ff-default-values`, `ff-bootstrap-distinct-id-mismatch`, `ff-identified-only-pre-auth-targeting`, `ff-eval-before-identify`, `ff-active-but-unreferenced`, `ff-stale-rolled-out`, `ff-local-eval-polling-interval`, `ff-local-eval-in-edge-handlers`, `ff-test-ci-gating`, `apply-fixes`, `write-report`.

Check areas (group headings in the plan tab and report): `Feature Flags — Delivery`, `Feature Flags — Observability`, `Feature Flags` (correctness), `Feature Flags — Optimize` (cost), `Workflow`.

Statuses: `pending` | `pass` | `error` | `warning` | `suggestion`. Severity meanings:
- `error`: must fix — broken functionality or guaranteed wrong behavior.
- `warning`: should fix — a pattern that causes subtle bugs, wrong data, or silent failure.
- `suggestion`: nice to have — best-practice or cost-savings opportunity.

After the report is written, delete `.posthog-audit-checks.json` if it exists.

## Pre-flight

Emit `[STATUS] Detecting PostHog feature flag usage`, then run two `Grep` calls in parallel (`output_mode: "files_with_matches"`):

1. Flag API surface: `getFeatureFlag|isFeatureEnabled|useFeatureFlag|onFeatureFlags|reloadFeatureFlags|getFeatureFlagPayload|featureFlags\.|posthog\.feature_enabled`
2. Local-evaluation signals: `personal_api_key|getAllFlagsAndPayloads|getAllFlags`

Decision:
- Surface grep has zero hits AND the PostHog SDK is absent from the project (no `posthog-js`/`posthog-node`/etc. in a package manifest, no `posthog.init(`): emit `[ABORT] PostHog SDK not installed` and stop.
- Surface grep has zero hits but the SDK is present: emit `[ABORT] No feature flag usage` and stop.
- If flag-roster MCP calls later fail with a permissions error: emit `[ABORT] Insufficient permissions` and stop.

The wizard catches `[ABORT]` and terminates the run cleanly — do not halt yourself.

Record for later: whether **local evaluation** is in use (second grep has ≥1 hit) — it gates two optimize checks; and resolve `ff-presence` as `pass` with the call-site count in `details`.

## Phase 1 — Verify (read-only)

Run the checks in `references/checks.md`, in this order:

1. **Static checks** (correctness + cost) — dispatch the parallel subagents exactly as specified. These need no credentials.
2. **Live checks** (delivery + observability) — run after the static fan-out returns. These use the project token, the `/flags` endpoint, and the MCP flag roster. If credentials or MCP are unavailable, each live check degrades as its own section specifies (resolve as `suggestion` with a `details` explanation — never block the audit).

This phase is strictly read-only: `Grep`/`Read`/`Glob`, plain `curl` probes, and read-only MCP calls only. Do not modify anything yet.

## Phase 2 — Confirm which fixes to apply

Classify each finding by fix type using `references/remediation.md`: `code`, `settings`, or `manual`. Only `code` and `settings` findings are auto-fixable; `manual` findings go to the report's "Manual follow-up" section.

**Apply the interlock first (tenet 2):** if `ff-evaluated-not-reported` resolved as `warning` or `error`, remove every tenant-side archive/disable option (`settings` fixes derived from `ff-active-but-unreferenced` or `ff-stale-rolled-out`) from the multi-select. Keep the fix that restores evaluation reporting. Explain the gating in the prompt text ("cleanup suggestions are withheld until evaluation events are verified — see report").

- If there are **no findings**, skip the confirm step, write a clean-bill report, and stop.
- If findings exist but **none are fixable** (all `manual`), skip the confirm step, write the report with them under "Manual follow-up", and stop.
- Otherwise call `mcp__wizard-tools__wizard_ask` **exactly once**:
  - `kind: "multi"`.
  - `prompt`: short summary, e.g. "Found N feature flag issues. Select the ones you'd like me to fix:". Mention manual-only findings are in the report.
  - `options`: one `{ label, value }` per fixable finding. `value`: the check id (or `"<checkId>:<flag-key>"` for per-flag rows).
  - **`label` is ONE short line — 80 characters or fewer, no newlines.** The option schema has no description field, so a multi-line label is a wall of text in the overlay. Format: `"[<SEVERITY>] <what will change> — <file or flag>"`. Reasoning, evidence, and file:line detail belong in the report, never here.
    - Good: `"[SUGGESTION] Fix typo'd flag key beta-serach → beta-search — src/nav.tsx:41"`
    - Good: `"[WARNING] Send evaluation events for promo-banner — promo-banner.tsx:16"`
    - Bad: any label that explains *why*, spans lines, or restates the check's rationale.
  - **Options are fixes the doctor will apply — nothing else.** Never include "Skip", "I'll do it manually", "No action needed", or any informational/placeholder option: selecting nothing already skips everything, and `manual` findings live in the report, not the multi-select. Every option, when selected, must map to a concrete `code` or `settings` remediation from `references/remediation.md`.
- If `wizard_ask` returns an error (non-interactive host / CI), do NOT fail: skip the fix phase, write the report with all findings under "Manual follow-up", and stop.
- The user may select nothing — apply nothing and write the report.

Emit `[STATUS] Asking which fixes to apply` before the call.

## Phase 3 — Apply the selected fixes

For each selected finding (and only those), apply the remediation mapped in `references/remediation.md`:

- **code** fixes: locate the file with Grep/Read, then Edit. Read a file immediately before editing it. Minimal change for that finding only.
- **settings** fixes: apply via the MCP flag-mutation tool if available; otherwise record as manual guidance.
- Respect the safe cleanup order (remediation.md): flags still referenced in code are NEVER disabled/archived in PostHog by the doctor — code gate first, then the user deploys, then they disable. Only zero-reference flags may be archived directly, and only when the interlock allows.
- Track what changed per fix (file or flag), so "Fixes applied" is accurate.
- Resolve `apply-fixes` in the ledger when done (pass if all selected fixes applied).

Emit `[STATUS] Applying fix: <name>` before each fix.

## Output

Write `posthog-feature-flags-report.md` to the project root following `references/report-format.md`, then display the report contents in chat as plain markdown (no wrapper commentary). Resolve `write-report` in the ledger, delete `.posthog-audit-checks.json` if present, and output one final line confirming the report path.

## Constraints

- Modify code or PostHog state **only** for findings the user explicitly selected, and only the change mapped in `references/remediation.md`.
- Never archive/disable a flag that still has code references. Never offer tenant-side cleanup while the interlock is failing.
- Every `/flags` probe uses a realistic browser User-Agent and plain `curl`. No pipes to shells, no command substitution around secrets.
- Do NOT include PII or key values in the report — flag keys, hosts, paths, counts, and `reason` codes only.
- Do NOT call `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList` — progress comes from the ledger and `[STATUS]` lines.

## Status

- Detecting PostHog feature flag usage
- Auditing feature flag correctness
- Auditing feature flag cost optimization
- Probing /flags delivery
- Cross-checking delivered flags against definitions
- Checking flag keys referenced in code exist in PostHog
- Verifying evaluation events are reported
- Asking which fixes to apply
- Applying fix: <name>
- Writing report
- Done

## Abort statuses

Report abort states with `[ABORT]` prefixed messages — wording must match exactly so the wizard renders the right error UI:

- `[ABORT] No feature flag usage` — no flag call sites found, but a PostHog SDK is present.
- `[ABORT] PostHog SDK not installed` — no flag call sites and the PostHog SDK is not present in the project.
- `[ABORT] Insufficient permissions` — the flag roster / query calls fail with a permissions error.

Stop all further work after emitting `[ABORT]`.

## Framework guidelines

{commandments}
