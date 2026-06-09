---
next_step: null
---

# Step 4 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded for this skill ends up in the report, even passes; nothing is invented.

## Status

Emit:

```
[STATUS] Writing session replay audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-session-replay-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes and optimizations with `file:line` where applicable.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — short closing block explaining what this audit covered.

For the Full audit section, group rows by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. This skill produces two areas: **Session Replay** (fix) and **Session Replay — Optimize** (cost). Render whatever areas the ledger actually contains.

For each area, write a one-paragraph framing immediately under the area heading, then the table.

## Report template

<wizard-report>
# PostHog Session Replay Audit Report

## Summary

[1–2 sentence overview: runtimes covered (web/mobile/both), overall replay health, and which lens — fix, optimize, or both — surfaced issues.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have / cost savings)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Session Replay | [label] | [file:line] | [details] |

If there are no problematic items, write `_No issues found — your session replay setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by area within a severity (Session Replay → Session Replay — Optimize). Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the data-quality or cost consequence. For fix-side checks: which downstream behaviour (bounce recordings, masked PII, test-noise) this finding affects. For optimize-side checks: the billing or volume impact, quoting the ratio or count from `details`.
3. **How to fix** — one short imperative sentence pointing at `file:line` (or "no specific code site — adjust project settings" for MCP-only findings) and the concrete change. End with a docs link.

Format:

1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).

Suggested docs URLs:
- `replay-minimum-duration-set`, `replay-strict-minimum-duration`, `replay-sampling-rate`, `replay-triggers-configured`, `replay-mobile-sampling` → https://posthog.com/docs/session-replay/how-to-control-which-sessions-you-record
- `replay-mask-config` → https://posthog.com/docs/session-replay/privacy
- `replay-disabled-in-test-envs` → https://posthog.com/docs/libraries/js/config
- `replay-network-recording-filtered` → https://posthog.com/docs/session-replay/network-recording

If there are no actions, write `_Nothing to fix._`.

## Full audit

### Session Replay

This area covers correctness of the session replay SDK configuration: that a minimum duration is set so bounce sessions don't get recorded, that `maskAllInputs` is not disabled on a project that handles PII, that session replay is gated off in test / CI environments, and that `strictMinimumDuration` is opted into ahead of becoming the SDK default.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Session Replay — Optimize

This area covers cost-side replay health: whether the project's sample rate matches its recording volume, whether URL / event / feature-flag triggers focus recording budget on important sessions, whether network/performance recording payloads are filtered, and whether mobile SDK replays use sampling. Optimize checks use the PostHog API/MCP to read the operator's project settings; rows showing `mcp_skipped: true` in `details` indicate MCP was unavailable.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

[Repeat the heading + paragraph + table for each area in ledger order, in case future versions of this skill add new areas.]

## About this audit

This audit ran the PostHog `audit-session-replay` skill — a focused, read-only check of session replay health across two lenses: **fix** (correctness) and **optimize** (cost). Fix checks scan the project source; optimize checks additionally query the PostHog project via MCP in read-only mode (and gracefully skip when MCP is unavailable).

- `error` items break correctness now (privacy / compliance risk). Fix first.
- `warning` items work today but cause subtle bugs or noticeably elevated cost. Fix when convenient.
- `suggestion` items are best-practice improvements or cost-savings opportunities with measurable upside.

Re-run `posthog-wizard audit-session-replay` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-session-replay-report.md>
```
