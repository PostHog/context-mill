---
next_step: null
---

# Step 10 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded ends up in the report, even passes; nothing is invented.

## Status

Emit:

```
[STATUS] Writing audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes with `file:line` and a docs link per item.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — a short closing block explaining what the audit covered and how to interpret the report.

For the Full audit section, group rows dynamically by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. Today the audit-3000 chain produces up to six areas — **Installation**, **Identification**, **Event Capture**, **Event Quality**, **Feature Flags**, **Use Case: Expansion** — but the report must not hard-code that list; render whatever areas the wizard seeded and the chain resolved.

For each area, write a one-paragraph framing immediately under the area heading, then the table. Use the canonical copy below verbatim when the area name matches; otherwise write a one-sentence summary derived from the area's check labels.

## Report template

<wizard-report>
# PostHog Audit Report

_If `posthog-enrichment.md` exists at the project root, render a **Customer context** block directly under the `# PostHog Audit Report` heading, before the Summary. `Read` `posthog-enrichment.md` once and pull only the badge line and inputs. Otherwise omit this block entirely._

```
_See also: [Customer enrichment context](./posthog-enrichment.md)_

> **Customer context:** <Archetype> · <Scale tier> · <Use case primary>
> **Domain:** `<DOMAIN>` · **Operator:** `<EMAIL>`
```

## Summary

A **2–4 sentence** overview. Cover:

1. The runtime(s) the audit ran against (client-side React + Vite, server Node, both, etc.) — derived from Step 1's SDK detection.
2. Overall health framing — phrase it as a status, not just a number (e.g., "Solid SDK + identification foundation, with event-quality issues dominating the remaining work" beats "0 errors, 7 warnings").
3. The single most impactful finding the operator should act on first, named explicitly.
4. If the audit ran with PostHog MCP available (i.e. event-usage-coverage or stale-feature-flags-reviewed didn't skip), say so — the audit found real downstream data.

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Installation | [label] | [file:line] | [details] |

If there are no problematic items, write `_No issues found — your PostHog setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by ledger order within a severity. **Each item is a self-contained sub-section with five labeled parts** so the operator can read just that one finding and have everything they need. Aim for ~150–400 words per finding — terse three-sentence summaries are NOT acceptable.

For each finding, render:

### N. [Area] · [Check label]

> **File:** `<file:line>` · **Severity:** `<error | warning | suggestion>`

**Diagnosis** (2–4 sentences). Describe precisely what was detected, drawing from the check's `details` field plus a quick `Read` of the cited file to confirm. Quote the exact pattern, name, or value involved. Don't paraphrase to the point of vagueness — the operator should be able to grep for it.

**Why it matters** (3–6 sentences). Spell out the concrete downstream impact. Name the specific PostHog features that get distorted (e.g. "any funnel with `signup_completed` as a step", "the Lifecycle insight for first-time users", "retention cohorts keyed on the `user_signed_up` event", "experiment exposure counts for any flag evaluated by `useFeatureFlagVariantKey`"). If billing is affected (e.g. duplicated events doubling ingestion costs), say so explicitly. Use the canonical "why it matters" copy below verbatim when a check id matches; otherwise write fresh prose rooted in PostHog's data model — never generic "this could cause issues" hand-waving.

**Currently** — a fenced code block showing the **actual** code at `file:line`. `Read` the file once with a small line range around the cited line and paste the relevant slice. Use the file's language (e.g. ` ```tsx `, ` ```python `). Keep it under ~15 lines.

**Recommended** — a fenced code block showing the **rewritten** version. Same language. Preserve the file's existing indent/style/imports — don't suddenly introduce a new pattern the project doesn't already use elsewhere. If the fix is "delete this line", show the before with the line and the after without it.

**Sources** — a bullet list of **2–4 authoritative references**, in this priority order:

1. The most specific PostHog docs page for this check (e.g. `https://posthog.com/docs/product-analytics/best-practices` for naming, `https://posthog.com/docs/feature-flags/installation` for flag patterns).
2. If the bundled `best-practices.md` reference covers this finding, cite it as `[Best practices reference (bundled with this audit)](#)` — readers can find the file in `.claude/skills/audit-3000/references/best-practices.md`.
3. Cross-reference any related finding in this same report by its number, e.g. _"See also finding #4 — same `signup` duplication pattern."_
4. When the finding is about an SDK call, link the relevant SDK reference page on `posthog.com/docs/libraries/<framework>`.

Use real PostHog URLs only — do not invent. If unsure of the exact URL, link to the parent section (e.g. `https://posthog.com/docs/product-analytics/best-practices`) rather than fabricate a deep link.

If there are no actions, write `_Nothing to fix — your PostHog setup looks healthy._`.

## Full audit

### [Area from ledger]

For each area, render a **3–5 sentence educational intro paragraph** before the table. Cover:

1. What this audit area actually checks (the concrete signals).
2. Why PostHog's data model depends on this being right — name the specific feature(s) downstream.
3. The most common anti-pattern teams hit in this area, in one sentence (skip if not applicable).
4. A pointer to the PostHog doc that backs the rules in this area (one link).

Canonical area intros (use verbatim when the area name matches):

- **Installation** — _"Installation correctness covers two things: the right PostHog SDK is declared as a project dependency, and that dependency is reasonably up to date. Stale SDK versions silently miss bug fixes (e.g. session-replay payload regressions, feature-flag evaluation correctness, autocapture coverage) — and because each PostHog SDK is independently versioned, a project mixing posthog-js and posthog-node has to track both. See [PostHog SDK installation](https://posthog.com/docs/libraries)."_
- **Identification** — _"Identification controls how PostHog tells two browser sessions apart from one logged-in user. Without a stable `distinct_id`, person counts double (an anonymous and an identified visitor count as two people), retention curves split the same user across multiple rows, and any breakdown by `person.properties.*` becomes unreliable. The most common anti-pattern: identifying late (after events have already fired in the session) or forgetting to `reset()` on logout. See [Identifying users](https://posthog.com/docs/getting-started/identify-users)."_
- **Event Capture** — _"Event capture audits the call-sites: are event names static strings (so PostHog's taxonomy isn't polluted with dynamic per-user values), is traffic routed through a reverse proxy (so ad-blockers don't drop events), and are the core growth events present (`$pageview`, `$pageleave`, signup, conversion)? Dynamic event names from string interpolation are the #1 reason taxonomies balloon to thousands of useless events. See [Capturing events](https://posthog.com/docs/product-analytics/capture-events)."_
- **Event Quality** — _"Event quality looks across all captures: naming consistency, duplicate events firing from multiple sites, kitchen-sink events with too many properties, PII leakage, hot-path captures, and (when PostHog MCP is available) whether the events are actually used downstream in any insight, dashboard, action, or destination. A single duplicate event (e.g. `signup_completed` and `user_signed_up` both firing in the same handler) inflates every funnel and retention metric that touches signups, sometimes by 100%. See [Product analytics best practices](https://posthog.com/docs/product-analytics/best-practices)."_
- **Feature Flags** — _"Stale feature flag hygiene matters because PostHog evaluates every active flag on every flag call, and flags with no code references still incur evaluation cost, still appear in experiment dashboards, and still create confusion when someone wonders 'is this flag still serving traffic?'. This audit lists flags PostHog has classified as stale and cross-references each against the project's source tree — but never disables them automatically. See [Cleaning up stale feature flags](https://posthog.com/docs/feature-flags/cleaning-up-stale-flags)."_
- **Use Case: Expansion** — _"Use-case expansion finds places in this specific codebase where adopting an additional PostHog product (Session Replay, Feature Flags, Surveys, Logs, etc.) would yield disproportionate value — but only when the codebase already shows signal that the team is ready (e.g. already using error tracking before recommending Session Replay attachment, already using LLM calls before recommending LLM Observability). Every suggestion in this area is gated by a presence detector — we never recommend a product the project shows no inclination toward."_

If an area not in this list appears in the ledger, write 3–5 sentences derived from its check labels following the same shape (what / why / common anti-pattern / docs link).

After the intro paragraph, render the table:

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

[Repeat heading + paragraph + table for each area in ledger order.]

## Stale feature flag cleanup playbook

_Render this section only if the ledger contains a `stale-feature-flags-reviewed` entry whose `details` field parses as JSON with `stale_count > 0`. If `stale_count` is 0, or the check is missing, or `details` is a skip reason, omit this section entirely._

The audit found stale flags in PostHog but did **not** disable or delete any of them — that decision belongs to a human. Below is a per-flag breakdown followed by a copy-paste prompt you can run in any PostHog MCP-enabled chat to disable the safe ones.

### Findings

Render three sub-tables, one per classification in the JSON `details`. Omit a sub-table when its array is empty.

**Safe to disable** _(zero code references, no active experiment, non-partial rollout)_

| Flag key |
|----------|
| `<flag_key>` |

**Needs review** _(blocked from automatic disable — fix the blocker first)_

| Flag key | Blocker | File |
|----------|---------|------|
| `<key>` | code-references / active-experiment / partial-rollout | `<path:line or —>` |

**Inconclusive** _(grep was ambiguous; verify manually before acting)_

| Flag key |
|----------|
| `<flag_key>` |

### Copy-paste prompt

Paste the block below into any PostHog MCP-enabled chat to walk through a safe cleanup. The prompt is parameterized on the **Safe to disable** list only — the agent will refuse to touch anything else.

```
I want to safely disable a set of feature flags in PostHog that a recent audit
classified as safe-to-disable. The flag keys are: [<comma-separated keys from
the "Safe to disable" table>].

For EACH flag, in this exact order:
1. Call posthog:feature-flag-get-all with `search: "<key>"` to resolve the flag id.
2. Re-confirm zero code references by grepping the current working tree for the
   literal flag key. If you find any reference, SKIP that flag and tell me which
   one and where.
3. Re-confirm via posthog:feature-flag-get-definition that experiment_set is empty
   or contains only ended experiments. If an active experiment is attached, SKIP
   that flag and tell me which one.
4. Only when 2 AND 3 pass: call posthog:update-feature-flag with `active: false`
   for that flag id. Do not call posthog:delete-feature-flag — disable is
   reversible, delete is not.
5. After all flags are processed, give me a short summary: which were disabled,
   which were skipped, and the skip reason for each.

Do not change any other flag. Do not modify rollout percentages, release
conditions, payloads, or names. Disable only.
```

For flags in the **Needs review** table, address the blocker first: remove the code reference (and deploy), end the linked experiment, or get explicit operator approval on the partial-rollout product intent. Then re-run the audit so the next pass re-classifies them.

## About this audit

The PostHog wizard runs a multi-step audit chain (the exact step list lives in the skill's reference files) ending in this report. Each step resolves one or more checks against the project's source tree; the **Event Quality**, **Feature Flags**, and **Use Case: Expansion** areas may additionally read from the PostHog project (event usage, stale flags, in-codebase expansion signals) in read-only mode. Every result — pass or otherwise — is recorded in the ledger this report was generated from.

If a `posthog-enrichment.md` file is present alongside this report, it carries **company + person context** (funding stage, headcount, archetype, scale tier) from the customer-enrichment step, plus a **Use case match** section pointing at the playbook to lead with. Both are intentionally outside the ledger — they never produce pass/warning/error counts, only context. Cross-reference them when interpreting the audit.

- `error` items break correctness now (events lost, identity broken). Fix first.
- `warning` items work today but cause subtle data-quality bugs. Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside.

Re-run `posthog-wizard audit` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-report.md>
```
