---
next_step: null
---

# Step 10 — Generate the audit report

This step produces **exactly one file** at the project root: `posthog-audit-report.md`. It is the only artifact of the entire audit chain. Read this rule literally — see "File-creation contract" below.

The report is rendered from three inputs:

1. **`.posthog-audit-checks.json`** — the audit ledger; one entry per resolved check. This is the source of truth for severity, area, and per-check details.
2. **`/tmp/posthog-enrichment-staged.md`** — the staged enrichment + use-case-match content from Steps 7 + 8 (only exists when those steps actually ran). Step 10 reads it once and inlines its content into the report as two dedicated sections, then **deletes the staged file**.
3. **`/tmp/posthog-use-case-match.json`** — machine-readable primary/secondary use-case slugs from Step 8 (only exists when Step 8 ran). Step 10 reads it once for the **Playbook alignment** subsection inside **Use case expansion & cross-sell**, then **deletes it** with the other `/tmp/` cleanup.

Step 7 writes **`/tmp/co.json`** and **`/tmp/pe.json`** (raw Harmonic/PDL bodies for Step 8 only). Step 10 does **not** read them when rendering the report; still **delete them in the same cleanup `rm`** so enrichment payloads never linger orphaned in `/tmp/`.

## File-creation contract

The ONLY file this step creates is `posthog-audit-report.md` at the project root. Specifically:

- Do **NOT** create `posthog-enrichment.md` at the project root (Step 7's content lives staged in `/tmp/` and is inlined here).
- Do **NOT** create `posthog-audit-3000-report.md`, `posthog-audit-summary.md`, or any other "summary" / "meta" / "overview" file. The single `posthog-audit-report.md` IS the deliverable.
- Do **NOT** create any sidecar JSON, CSV, or notes file **at the project root**.
- Do **NOT** leave `/tmp/posthog-enrichment-staged.md`, `/tmp/posthog-use-case-match.json`, `/tmp/co.json`, `/tmp/pe.json`, or `.posthog-audit-checks.json` behind — delete them all in one `rm -f` (missing paths are ignored).

If you have written more than one new file at the end of this step, you have done it wrong. Re-read this section and consolidate.

## Status

Emit:

```
[STATUS] Writing audit report
```

## Action

1. `Read` `.posthog-audit-checks.json` once. This is the ledger source for severity counts, problematic items, recommended actions, and full audit.
2. Check whether `/tmp/posthog-enrichment-staged.md` exists. If it does, `Read` it once — it holds the Customer context block (Step 7) and the Use case match section (Step 8) ready to inline.
3. Check whether `/tmp/posthog-use-case-match.json` exists. If it does, `Read` it once — it holds `skipped`, `primary`, `secondaries`, and `scores` for the **Playbook alignment** subsection (see **Use case expansion & cross-sell** in the template below). If the file is missing, treat playbook alignment as unavailable for this run. **Also use this file when building the Customer context blockquote** if the staged file has no `**Use case:**` line (see **Customer context blockquote** below).
4. Render `posthog-audit-report.md` at the project root using the template below. Inline staged enrichment / use-case-match content **only when the staged markdown exists**; otherwise omit those sections entirely.
5. **Cleanup:** after the report is written, delete all audit temp artifacts and the ledger in **one** `Bash` call ( `-f` ignores missing files): `/tmp/posthog-enrichment-staged.md`, `/tmp/posthog-use-case-match.json`, `/tmp/co.json`, `/tmp/pe.json`, and `.posthog-audit-checks.json`. Example: `rm -f /tmp/posthog-enrichment-staged.md /tmp/posthog-use-case-match.json /tmp/co.json /tmp/pe.json .posthog-audit-checks.json`

## Report structure (top to bottom)

```
# PostHog Audit Report

> [Customer context badge]                    ← only if staged enrichment exists

## Summary                                    ← always
## Customer context                           ← only if staged enrichment exists
## Use case recommendation                    ← only if staged enrichment includes Use case match
## Recommended actions                        ← always (or "_Nothing to fix_" placeholder)
## Stale feature flag cleanup playbook        ← only if stale_count > 0
## Use case expansion & cross-sell            ← only if any expansion-* check is non-pass
## Full audit                                 ← always
## About this audit                           ← always
```

## Report template

<wizard-report>
# PostHog Audit Report

### Customer context blockquote (prepend when staged enrichment exists)

Build the two-line blockquote **before** the `## Summary` heading. Do **not** assume the staged file always contains `**Use case:**` — Step 8 only adds that line after a successful match (score floor). When Step 8 skips (low confidence, no enrichment, etc.), Step 7 may still have left **`/tmp/posthog-enrichment-staged.md`** with only `**Classification:** <Archetype> · <Scale tier>`.

1. **Archetype & scale tier:** From the staged file, read the line starting with `**Classification:**`. Take the text after the colon, trim it, split on ` · ` (space-middle-dot-space). The first segment is `<Archetype>`, the second is `<Scale tier>`. If the line is missing, use `_Unknown_` for each.

2. **Third slot (use case label):** Use the **first** source that applies:
   - If the staged file contains a line starting with `**Use case:**`, strip the bold markers and trailing italic hint; use the remainder as the human-readable primary label (may still say “see Use case match below”).
   - Else if `/tmp/posthog-use-case-match.json` was read and `"skipped" === false`, set the third slot to the primary slug formatted for humans (e.g. `product-intelligence` → “Product intelligence”) or use `primary.slug` in monospace if you prefer — **do not invent** a display name not grounded in JSON.
   - Else if that JSON exists and `"skipped" === true`, set the third slot to `_Not matched_` and append the reason in parentheses if helpful (e.g. `_Not matched (low confidence)_`, `_Not matched (no enrichment)_`).
   - Else set the third slot to `_Not matched_`.

3. **Domain & operator:** From the staged file, read the **`Inputs`** block (bullets under `**Inputs**`): use the `Company domain` bullet value inside backticks for **Domain**; use the `Email` bullet value for **Operator**. If a bullet is missing, use `_Unknown_` for that slot.

4. **Emit** the full two-line blockquote in one fenced shape (line 1 always has three ` · ` segments):

```
> **Customer context:** <Archetype> · <Scale tier> · <third slot from step 2>
> **Domain:** `<domain from Inputs>` · **Operator:** `<email from Inputs>`
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

## Customer context

_Render this section only if `/tmp/posthog-enrichment-staged.md` exists. Copy verbatim from the staged file the **`## Company`** section (including the company table, headcount-by-team, traction signals, industry & tags, employee highlights, and related companies — all the rich Harmonic data). If the staged file has a `## Person` section with content (i.e., PDL returned data), copy that too underneath the Company block. Strip the top-level `# PostHog Audit — Customer Enrichment` heading; the audit report already has its own title._

_If the staged file does not exist, omit this section entirely — no placeholder, no "enrichment skipped" note._

## Use case recommendation

_Render this section only if `/tmp/posthog-enrichment-staged.md` exists AND it contains a `## Use case match` block (Step 8 ran)._ Copy that block's content verbatim:

- The Primary line (with playbook link)
- The Secondary line (if present)
- The "Why this match" bullets
- The Persona to target line
- The Recommended PostHog products to lead with line

Strip the `## Use case match` heading from the staged content — the heading here is `## Use case recommendation` (one section in the consolidated report).

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

**Note on `expansion-*` checks:** these are NOT rendered as Recommended actions items. They have their own dedicated section ("Use case expansion & cross-sell" below) with a different structure — do not duplicate them here.

If there are no actions, write `_Nothing to fix — your PostHog setup looks healthy._`.

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

## Use case expansion & cross-sell

_Render this section only if at least one ledger entry whose `id` starts with `expansion-` has `status != pass`. If every `expansion-*` check is `pass` (or the wizard didn't seed any expansion ids and the agent didn't create any), omit this section entirely._

Step 9 audited the project for three classes of expansion opportunities across each PostHog product: existing **competitive software** that PostHog can replace ("cross-sell"), areas with **no tool at all** that PostHog can introduce ("adoption"), and **coverage gaps** within PostHog products that are already in use. The findings below are parsed from the `details` JSON on each `expansion-*` ledger entry.

Render three sub-tables. Omit any sub-table that's empty.

### Cross-sell opportunities

_Entries where `details.mode == "cross-sell"`._

The project is already using a competing tool for this concern. PostHog covers it natively — consolidating saves SaaS spend, simplifies the stack, and unifies data across PostHog's other products (analytics, replays, flags, experiments).

| Detected tool | PostHog replacement | Evidence | Pitch |
|---|---|---|---|
| `<competitor>` | `<PostHog product>` | `<file:line or package@version>` | `<details.pitch>` |

### Adoption opportunities

_Entries where `details.mode == "greenfield"`._

No tool detected for this concern. These are PostHog product areas where the project has nothing today — adopting PostHog avoids the cost of evaluating, integrating, and maintaining a separate vendor.

| Concern | PostHog product to adopt | Why now (informed by enrichment if present) |
|---|---|---|
| `<area>` | `<PostHog product>` | `<details.pitch>` |

### Coverage gaps in existing PostHog usage

_Entries where `details.mode == "gap"`._

PostHog is already adopted for this concern, but some surfaces in the codebase aren't yet wired up. Closing these gaps is low-effort, high-value — the team already understands the API.

| PostHog product | Surface missing coverage | File:line | Suggested fix |
|---|---|---|---|
| `<PostHog product>` | `<surface>` | `<file:line>` | `<details.pitch>` |

### Playbook alignment

_Render this subsection only when **all** of the following are true: (1) the parent **Use case expansion & cross-sell** section is included (at least one `expansion-*` check has `status != pass`), (2) `/tmp/posthog-use-case-match.json` was read successfully, and (3) `"skipped" === false` in that JSON._

Parse each `expansion-*` ledger row’s `details` as JSON (it may be stored as a string — parse if needed). Step 9 adds optional fields `"playbook"` (`"primary"` \| `"secondary"` \| `null`) and `"playbook_slugs"` (string array).

1. **Summary paragraph:** State the enrichment-backed **primary** use case slug and score (`primary.slug`, `primary.score`) from the JSON snapshot, and list **secondary** slug(s) with scores if `secondaries` is non-empty; if there are no secondaries, say so explicitly.

2. **Alignment table:** Include every `expansion-*` row where parsed `details.playbook` is `"primary"` or `"secondary"`. Omit this table entirely if there are zero such rows.

| Check (ledger id) | Playbook role | Mode | Pitch |
|---|---|---|---|
| `expansion-error-tracking` | primary | `cross-sell` | `<details.pitch>` |

3. If there are **no** rows with `playbook` ∈ {`primary`, `secondary`} but the snapshot was valid, write one line: _No `expansion-*` checks tied to the matched playbook rows produced a cross-sell, adoption, or gap finding — playbook-aligned products are fully `pass` or unmapped by the eight automated products._

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
- **Session Replay** — _"Session replay correctness covers four codebase-only checks: minimum duration (so bounce sessions aren't recorded), `maskAllInputs` (so projects with PII surfaces don't leak input contents into replays), test/CI gating (so synthetic sessions don't flood the recording pipeline), and `strictMinimumDuration` (an opt-in that will become the SDK default — adopting it early future-proofs the config). The most common anti-pattern is enabling replay without a minimum duration, which records every bounce. See [How to control which sessions you record](https://posthog.com/docs/session-replay/how-to-control-which-sessions-you-record)."_
- **Session Replay — Optimize** — _"Cost-side replay health: sampling rate vs. actual recording volume, URL / event / feature-flag triggers to focus the recording budget, network and performance recording payload filtering, and per-runtime mobile sampling (mobile replays are larger per session than web). These checks use the PostHog MCP to read the operator's project settings and event volume; rows showing `mcp_skipped: true` in `details` indicate MCP was unavailable. The most common cost regression is 100% sampling on a high-volume project with no triggers. See [How to control which sessions you record](https://posthog.com/docs/session-replay/how-to-control-which-sessions-you-record)."_
- **Use Case: Expansion** — _"Use-case expansion runs three detectors per PostHog product: is the PostHog product in use? is a competitor in use? does the codebase have any tool for this concern? Findings split into cross-sell (competitor detected — PostHog can replace it), adoption (nothing detected — PostHog can fill the gap), and coverage gaps (PostHog already in use but missing on important surfaces). The dedicated 'Use case expansion & cross-sell' section above renders the per-mode breakdown; the table here is just the per-check ledger record."_

If an area not in this list appears in the ledger, write 3–5 sentences derived from its check labels following the same shape (what / why / common anti-pattern / docs link).

After the intro paragraph, render the table:

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

[Repeat heading + paragraph + table for each area in ledger order.]

## About this audit

The PostHog wizard runs a multi-step audit chain (the exact step list lives in the skill's reference files) ending in this report. Each step resolves one or more checks against the project's source tree; the **Event Quality**, **Feature Flags**, and **Use Case: Expansion** areas may additionally read from the PostHog project (event usage, stale flags) and from third-party signals (competitor SDK detection) in read-only mode. Every result — pass or otherwise — is recorded in the ledger this report was generated from.

The **Customer context** and **Use case recommendation** sections (when present) come from Steps 7 + 8 (Harmonic / PDL enrichment + use-case scoring). These are intentionally outside the ledger — they never produce pass/warning/error counts, only context for sales/CS interpretation. The **Use case expansion & cross-sell** section comes from Step 9, which audits the codebase for opportunities to expand PostHog footprint or replace competing tools; when Step 8’s playbook snapshot exists (`skipped: false`), **Playbook alignment** inside that section connects those technical findings to the scored primary/secondary use cases.

- `error` items break correctness now (events lost, identity broken). Fix first.
- `warning` items work today but cause subtle data-quality bugs. Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside.

Re-run `posthog-wizard audit` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written AND the cleanup step has run (deleting `/tmp/posthog-enrichment-staged.md`, `/tmp/posthog-use-case-match.json`, `/tmp/co.json`, `/tmp/pe.json`, and `.posthog-audit-checks.json`), emit a single final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-report.md>
```

Do not emit any other "Created ..." lines. The single audit report is the entire deliverable.
