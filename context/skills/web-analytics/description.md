# PostHog Web Analytics Doctor

This skill checks an existing PostHog project for common web-analytics misconfigurations and fixes the ones the user chooses. It works in three phases:

1. **Audit (read-only):** run HogQL checks against the project's events and settings to find issues.
2. **Confirm:** present the findings and let the user pick which ones to fix — a single `wizard_ask` multi-select.
3. **Fix:** apply only the selected fixes — to the user's code and/or their PostHog project settings — then write a report.

The audit never changes anything. Changes happen only in the fix phase, and only for the findings the user explicitly selected. Outputs: a markdown report at `posthog-web-analytics-report.md` and a structured JSON file at `posthog-web-analytics-findings.json`, both at the project root.

## Reference files

{references}

## Guiding tenets

1. **Consent-gated changes.** The audit is read-only. In the fix phase, change only what the user selected in the `wizard_ask` step — never touch a finding they didn't pick, and never make a change beyond the remediation mapped for that finding in `references/remediation.md`.

2. **Quote real data.** Every finding must cite the HogQL query that produced it and at least one concrete value (host name, event count, ratio). If a query returns nothing actionable, omit the finding — don't speculate.

3. **No fabricated severities.** Use the severity rules in `references/checks.md` exactly. If a check's data doesn't pass the threshold for `warning`, it's `info` or omitted.

4. **Skip checks gracefully.** If a check's prerequisite query fails mid-audit (missing permission, transient error, etc.), skip that check, record it in the `skipped` array of the JSON output, and continue. The JSON file MUST still be written even if some checks didn't run. Do **not** abort unless a hard precondition fails (see Abort statuses).

5. **Bounded query window.** See `references/checks.md` for the 7-day default and 30-day expansion rule. The window is decided once at pre-flight and reused for every check.

## Available tools

**Audit (read-only):**
- `mcp__posthog-wizard__query-run` (HogQL) — primary tool. Use for all event queries.
- `mcp__posthog-wizard__project-get` — fetch project settings, including `app_urls` (the user-configured authorized URLs).
- `mcp__posthog-wizard__docs-search` — to fetch the latest doc URL for a remediation link.

**Confirm:**
- `mcp__wizard-tools__wizard_ask` — ask the user which findings to fix. Call it **once** with a single multi-select question (see Phase 2).

**Fix:**
- `Read` and `Edit` — apply code fixes to the user's project (e.g. PostHog init options).
- A PostHog settings-mutation MCP tool (e.g. `mcp__posthog-wizard__project-update` or an equivalent settings/property update tool) — apply settings fixes. If you cannot find such a tool, do NOT guess a tool name and do NOT fabricate a call: record the fix as manual guidance in the report instead.

If you're unsure which MCP tools exist, discover them (tool search is enabled) and name tools explicitly so their schemas load. Never edit `.env` directly — if a fix needs environment values, use the wizard-tools MCP.

## Pre-flight

Before running any checks, verify the project has web analytics events and decide the analysis window in a single query:

```sql
SELECT
  countIf(timestamp > now() - INTERVAL 7 DAY) AS p7,
  count() AS p30
FROM events
WHERE event = '$pageview'
  AND timestamp > now() - INTERVAL 30 DAY
```

- If `p30 = 0`: look for a PostHog SDK in the project (e.g. `posthog-js` in a `package.json`, or a `posthog.init(` call). If none is found, emit `[ABORT] PostHog SDK not installed`. Otherwise emit `[ABORT] No web analytics events`. The wizard middleware catches `[ABORT]` and terminates the run cleanly — do not halt yourself.
- If `p7 >= 100`, use a 7-day window for every check. Otherwise use 30 days and set `expandedFromDefault: true` in the JSON output.
- If the query returns a permission error, emit `[ABORT] Insufficient permissions`.

Do not re-query to decide the window per check — the decision is made once here and reused.

## Phase 1 — Audit (read-only)

Run ALL checks in `references/checks.md`. This phase is strictly read-only — issue only `query-run` and `project-get` calls; do not modify anything yet.

The checks share no state — issue their `query-run` calls in parallel when your tool harness supports concurrent calls. Note that Checks 3 and 4 share a single combined query (see `checks.md`); run that query once and apply both pass/fail rules to the result.

For each check:

1. Read the check's HogQL query and pass/fail rule.
2. Run the query verbatim via `query-run`. Do not modify the query (other than swapping `INTERVAL 7 DAY` for `INTERVAL 30 DAY` if pre-flight selected the 30-day window).
3. Apply the rule. If it fires, capture: severity (per the rule), host(s) affected, raw counts, and the remediation doc URL listed in the check.
4. Report `[STATUS] Running check N: <name>` before each check.
5. Append the finding (or "passed") to your in-memory findings list.

Each check is independent and required. Do not skip a check based on intermediate findings. Do not invent new checks beyond the ones listed.

## Phase 2 — Confirm which fixes to apply

Classify each finding by its fix type using `references/remediation.md`: `code`, `settings`, or `manual`. Only `code` and `settings` findings are auto-fixable; `manual` findings always go to the report's "Manual follow-up" section.

- If there are **no findings at all**, skip the confirm step, write a clean-bill report, and stop.
- If there are findings but **none are `code` or `settings`** (all `manual`), skip the confirm step, write the report with those findings under "Manual follow-up", and stop.
- Otherwise, call `mcp__wizard-tools__wizard_ask` **exactly once** with a single question:
  - `kind: "multi"`.
  - `prompt`: a short summary, e.g. "Found N web analytics issues. Select the ones you'd like me to fix:". If there are manual-only findings, mention in the prompt that they're listed in the report (they are not selectable here).
  - `options`: one `{ label, value }` per `code`/`settings` finding. `label`: `"[<SEVERITY>] <title> — <one-line fix> (<host>)"`. `value`: a stable id, `"<checkId>:<host>"` (or just `"<checkId>"` for a project-wide finding).
  - Put **every** fixable finding into this one call — do NOT issue multiple `wizard_ask` calls in a row (the tool errors after repeated calls; batch up to 8 questions if you ever need more, but here one multi-select is enough).
- If `wizard_ask` returns an error (non-interactive host / CI), do NOT fail. Skip the fix phase, write the audit report with all findings under "Manual follow-up", and stop.
- The user may select nothing — if so, apply nothing and write the report.

Report `[STATUS] Asking which fixes to apply` before the call.

## Phase 3 — Apply the selected fixes

For each finding the user selected (and only those), apply the remediation mapped in `references/remediation.md`:

- **code** fixes: locate the relevant file (e.g. the `posthog.init(...)` call) with Grep/Read, then Edit it. Always Read a file immediately before editing it. Make the minimal change for that finding only.
- **settings** fixes: apply via the PostHog settings-mutation MCP tool if one is available; otherwise record the fix as manual guidance in the report.
- Never apply a fix for a finding the user did not select. Never make changes beyond the mapped remediation.
- Track, per fix, what changed (file + setting), so the report's "Fixes applied" section is accurate.

Report `[STATUS] Applying fix: <name>` before each fix.

## Output

Produce the results in **three places**:

1. **Write** `posthog-web-analytics-report.md` to the project root, following `references/report-format.md`. Human-readable, archival.
2. **Write** `posthog-web-analytics-findings.json` to the project root, following `references/findings-schema.md`. Machine-readable record of the audit and what was fixed.
3. **Display** the report contents in chat as plain markdown (no extra commentary, no fenced code block wrapping the whole thing — just the report). This is what the user reads when running the skill outside the wizard.

Both files MUST exist. The JSON and the markdown must describe the same set of findings and fixes — two views of the same run.

The report includes:

- A summary section: findings by severity (critical / warning / info), fixes applied, checks skipped.
- One section per finding: title, severity, affected host(s), evidence (query + counts), and either what was fixed or the remediation steps + doc link.
- A "Fixes applied" section listing each change the doctor made.
- A "Manual follow-up" section for findings that weren't auto-fixed (manual, settings with no available tool, or not selected).
- A "Checks passed" section listing every check that found no issues.
- A "Checks skipped" section listing any checks that couldn't run, with the reason.

After displaying the markdown report, output one final line confirming both file paths (e.g. `Report saved to posthog-web-analytics-report.md and posthog-web-analytics-findings.json`). No further commentary, no recap.

## Constraints

- Modify code or PostHog settings **only** for findings the user explicitly selected in the confirm step, and only the change mapped in `references/remediation.md`.
- Never write secrets to source and never edit `.env` directly — use the wizard-tools MCP for environment values.
- Do NOT run queries against more than 30 days of data — performance budget.
- Do NOT include personally identifiable information in the report (no email addresses, no user IDs, no session IDs, no IP addresses — host names, paths, and counts only).
- Do NOT fabricate or estimate values. Only report what the queries return and what you actually changed.
- Findings that don't meet a check's threshold are simply omitted, not labeled "OK". (Severity values are defined in `references/checks.md`.)

## Status

Report progress with `[STATUS]` prefixed messages:

- Verifying web analytics events
- Running check 1: Partial reverse proxy
- Running check 2: Dark authorized URLs
- Running check 3: Pageleave coverage per host
- Running check 4: Web Vitals coverage per host
- Running check 5: Duplicate canonical URLs across hosts
- Asking which fixes to apply
- Applying fix: <name>
- Writing report
- Done

## Abort statuses

Report abort states with `[ABORT]` prefixed messages — wording must match exactly so the wizard renders the right error UI:

- `[ABORT] No web analytics events` — pre-flight finds no `$pageview` events in the last 30 days, but a PostHog SDK is present.
- `[ABORT] PostHog SDK not installed` — pre-flight finds no `$pageview` events and the PostHog SDK is not present in the project.
- `[ABORT] Insufficient permissions` — `query-run` returns a permissions error on the pre-flight query.

Stop all further work after emitting `[ABORT]`.

## Framework guidelines

{commandments}
