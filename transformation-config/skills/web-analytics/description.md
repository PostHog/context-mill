# PostHog Web Analytics Doctor

This skill audits an existing PostHog project for common web-analytics misconfigurations. It is a **read-only audit**: it never writes code or PostHog config. The output is a markdown report at `posthog-web-analytics-report.md` and a structured JSON file at `posthog-web-analytics-findings.json`, both summarizing findings with severity and remediation links.

## Reference files

{references}

## Guiding tenets

1. **Read-only.** Never modify the user's source code or PostHog project settings. This skill audits; it does not remediate. Remediation is a follow-up the user runs themselves.

2. **Quote real data.** Every finding must cite the HogQL query that produced it and at least one concrete value (host name, event count, ratio). If a query returns nothing actionable, omit the finding — don't speculate.

3. **No fabricated severities.** Use the severity rules in `references/checks.md` exactly. If a check's data doesn't pass the threshold for `warning`, it's `info` or omitted.

4. **Skip checks gracefully.** If a check's prerequisite query fails mid-audit (missing permission, transient error, etc.), skip that check, record it in the `skipped` array of the JSON output, and continue. The JSON file MUST still be written even if some checks didn't run. Do **not** abort unless a hard precondition fails (see Abort statuses).

5. **Bounded query window.** See `references/checks.md` for the 7-day default and 30-day expansion rule. The window is decided once at pre-flight and reused for every check.

## Available MCP tools

- `mcp__posthog__query-run` (HogQL) — primary tool. Use for all event queries.
- `mcp__posthog__project-get` — fetch project settings, including `app_urls` (the user-configured authorized URLs).
- `mcp__posthog__feature-flag-get-definition` — only if a check needs flag context.
- `mcp__posthog__docs-search` — to fetch the latest doc URL for a remediation link.

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

- If `p30 = 0`, emit `[ABORT] No web analytics events`. The wizard middleware catches `[ABORT]` and terminates the run cleanly — do not halt yourself.
- If `p7 >= 100`, use a 7-day window for every check. Otherwise use 30 days and set `expandedFromDefault: true` in the JSON output.
- If the query returns a permission error, emit `[ABORT] Insufficient permissions`.

Do not re-query to decide the window per check — the decision is made once here and reused.

## How to run the audit

Run ALL checks in `references/checks.md` without pausing for user confirmation. The user will review the final report.

The checks share no state — issue their `query-run` calls in parallel when your tool harness supports concurrent calls. Note that Checks 3 and 4 share a single combined query (see `checks.md`); run that query once and apply both pass/fail rules to the result.

For each check:

1. Read the check's HogQL query and pass/fail rule.
2. Run the query verbatim via `query-run`. Do not modify the query (other than swapping `INTERVAL 7 DAY` for `INTERVAL 30 DAY` if pre-flight selected the 30-day window).
3. Apply the rule. If it fires, capture: severity (per the rule), host(s) affected, raw counts, and the remediation doc URL listed in the check.
4. Report `[STATUS] Running check N: <name>` before each check.
5. Append the finding (or "passed") to your in-memory findings list.

Each check is independent and required. Do not skip a check based on intermediate findings. Do not invent new checks beyond the ones listed.

## Output

Produce the audit results in **three places**:

1. **Write** `posthog-web-analytics-report.md` to the project root, following the format in `references/report-format.md`. Human-readable, archival.
2. **Write** `posthog-web-analytics-findings.json` to the project root, following the schema in `references/findings-schema.md`. Machine-readable; the wizard parses this to render the structured findings screen. The file MUST exist — the wizard's report screen depends on it.
3. **Display** the same report contents in chat as plain markdown (no extra commentary, no fenced code block wrapping the whole thing — just the report). This is what the user reads directly when running the skill outside the wizard.

Both files MUST exist. The JSON and the markdown must describe the same set of findings — they are two views of the same audit.

The report includes:

- A summary section: total findings by severity (critical / warning / info), checks skipped.
- One section per finding: title, severity, affected host(s), evidence (query + counts), remediation steps, doc link.
- A "Checks passed" section listing every check that found no issues, so the user knows the audit was thorough.
- A "Checks skipped" section listing any checks that couldn't run, with the reason.

After displaying the markdown report, output one final line confirming both file paths (e.g. `Report saved to posthog-web-analytics-report.md and posthog-web-analytics-findings.json`). No further commentary, no recap.

## Constraints

- Do NOT modify any source files.
- Do NOT write to PostHog (no creating dashboards, insights, actions, etc.).
- Do NOT run queries against more than 30 days of data — performance budget.
- Do NOT include personally identifiable information in the report (no email addresses, no user IDs, no session IDs, no IP addresses — host names, paths, and counts only).
- Do NOT fabricate or estimate values. Only report what the queries return.
- Findings that don't meet a check's threshold are simply omitted, not labeled "OK". (Severity values are defined in `references/checks.md`.)

## Status

Report progress with `[STATUS]` prefixed messages:

- Verifying web analytics events
- Running check 1: Partial reverse proxy
- Running check 2: Dark authorized URLs
- Running check 3: Pageleave coverage per host
- Running check 4: Web Vitals coverage per host
- Running check 5: Duplicate canonical URLs across hosts
- Writing audit report
- Audit complete

## Abort statuses

Report abort states with `[ABORT]` prefixed messages — wording must match exactly so the wizard renders the right error UI:

- `[ABORT] No web analytics events` — pre-flight finds no `$pageview` events in the last 30 days.
- `[ABORT] Insufficient permissions` — `query-run` returns a permissions error on the pre-flight query.

Stop all further work after emitting `[ABORT]`.

## Framework guidelines

{commandments}
