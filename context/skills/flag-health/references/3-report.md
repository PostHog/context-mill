---
next_step: null
---

# Step 3 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded for this skill ends up in the report, even passes; nothing is invented.

This report is deliberately short — it has one area (Flag Roster Alignment) and five checks, so it doesn't need the multi-area scaffolding a bigger audit skill does. But it should still read the way this repo's other audit reports do: a human opens it to find out what's broken and how to fix it, not to parse a data dump. **Summary** and **Recommended actions** come first and contain everything required to act — that's the whole report for someone who just wants to know what's wrong. **Full audit** and **About this audit** are reference material for someone who wants the detail behind a finding. Do not pad the summary or the actions list with restated detail from later sections.

## Status

Emit:

```
[STATUS] Writing flag alignment report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-flag-health-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

## Report template

<wizard-report>
# PostHog Flag Roster Alignment Report

[1–2 sentence overview: whether PostHog MCP was available for these checks, how many flags were in scope, and whether the codebase does client-side, server-side (local evaluation), or both kinds of flag evaluation.]

**Counts**

- **Warnings**: [N] (confirmed drift — fix these)
- **Suggestions**: [N] (needs an owner's call, or closes a documentation gap)
- **Passes**: [N]

**Problematic items** _(only `warning` and `suggestion` — no passes)_

| Severity | Check | Flag key(s) | File |
|----------|-------|-------------|------|
| ⚠️ warning | [label] | `[key]` | [file:line] |

If there are no problematic items, write `_Nothing found — your code and PostHog's flag configuration agree._` instead of the table, and skip straight to **Full audit**.

## Recommended actions

Numbered list, ordered warnings first, then suggestions. Each item is **three sentences**, in this order:

1. **What's wrong** — a plain-language diagnosis derived from `details`, naming the flag key(s) involved.
2. **Why it matters** — one sentence on the concrete consequence: what the SDK actually does differently because of this (a branch that never runs, a variant that's collapsed to a bool, a flag still billed on every request).
3. **How to fix** — one or two short imperative sentences pointing at `file:line` (or "no single code site — see PostHog flag settings" for a project-wide finding) with the concrete change to make.

Format:

`N. **[label]** — [what's wrong]. _Why it matters:_ [consequence]. _Fix:_ [concrete action] at `[file:line]`.`

For a `ff-stale-full-rollout` warning, the fix states the staged sequence: remove the call site's branching and deploy → confirm `$feature_flag_called` evaluations for that key stop → only then disable or delete the flag in PostHog. Never suggest a one-step delete.

For a `ff-ghost-flag-key` warning, phrase the fix as a fork, since there's no flag in PostHog to stage a removal against: either create the missing flag in PostHog (if the key was meant to exist), or remove the dead call site and deploy (if the flag was intentionally retired) — don't default to one branch without saying so.

Do not repeat the same finding twice: if `ff-stale-full-rollout`'s `details` notes overlap with `ff-active-but-unreferenced` for the same key, report it once under whichever check found the more specific problem (a branching dead-code reference is more specific than "no reference at all") and drop a one-clause cross-reference (e.g. "— see also the unreferenced-flags finding above") rather than writing it out twice.

If there are no actions, write `_Nothing to fix._`.

## Full audit

### Flag Roster Alignment

This area covers drift between the codebase and PostHog's live flag roster: flags active in PostHog with no code reference, code calling a flag key PostHog doesn't have, flags pinned at a fixed rollout for 30+ days with a live branch still on them, multivariate flags collapsed to booleans, and long-lived decided flags with no lifecycle tag.

| Check | Status | Details |
|-------|--------|---------|
| [label] | [glyph — ✅ pass / ⚠️ warning / 💡 suggestion] | [one-line detail from `details`, or blank for a clean pass] |

### Assumptions and blind spots

In ≤3 sentences: name anything a check couldn't verify from static analysis alone — e.g. a dynamically-resolved flag key that had to be traced through a local registry rather than read as a literal, a candidate excluded only because of a tag whose intent wasn't independently confirmable, or a check that resolved via `execute-sql` fallback instead of a typed listing tool. If nothing in this run required a judgment call like that, write `_No caveats — every finding above was resolved directly from PostHog's flag data and a literal code reference._`.

Only add a closing callout if a check resolved with `mcp_skipped: true` — one sentence: `[N] check(s) couldn't run without PostHog access: [labels]. Re-run once MCP is connected to cover them.` If everything resolved normally, omit this callout entirely — do not manufacture caveats.

## About this audit

This audit ran the PostHog `flag-health` skill — a focused, read-only check of how well the codebase's feature-flag calls line up with PostHog's actual flag configuration. It never edits project source and never changes PostHog state; the only file it writes is this report.

- `warning` items are a confirmed drift between code and PostHog — the SDK is silently doing the wrong thing, or a dead code path ships in every build. Fix these.
- `suggestion` items need an owner's judgment (unclear intent, no one to confirm) or flag a documentation gap (a long-lived flag with no tag) that makes the next audit's calls more reliable.

Re-run this audit after applying fixes to confirm the drift is gone.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-flag-health-report.md>
```
