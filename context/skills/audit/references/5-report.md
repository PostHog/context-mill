---
next_step: null
---

# Step 5 — Compose and publish the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded ends up in the report, even passes; nothing is invented. The finished markdown goes out in a single `publish_handoff` call; that call is how the report reaches the user, and the tool creates the shareable PostHog notebook from it. Nothing is left in the project.

## Status

Emit, in order:

```
[STATUS] Composing audit report
[STATUS] Publishing audit report
```

## Action

`Read` the ledger once, then build the report **incrementally into scratch state** — `Write` a skeleton with placeholder markers to `.posthog-wizard-cache/audit-report.md`, then `Edit` each placeholder with its real section in a separate turn. **Do not compose the whole report in one turn.** A single sustained generation of the full document routinely drops the LLM streaming connection around the 10-minute mark; chunking via Write + Edit keeps every turn short and resets the SSE timer at each tool call. A dropped turn then loses at most one section instead of the whole report.

That path is deliberate: `.posthog-wizard-cache/` is the wizard's scratch directory, not something the user reads, and you delete the file once the report is published. Do not write a report to the project root, and do not call `notebooks-create` — `publish_handoff` creates the notebook.

**Do not delete `.posthog-audit-checks.json` yet** — the publish sub-step still resolves two ledger rows. The cleanup happens at the very end of this step.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes with `file:line` and a docs link per item.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — a short closing block explaining what the audit covered and how to interpret the report. *Static text — use the canonical copy below verbatim.*

For the Full audit section, group rows dynamically by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. Today the core audit produces three areas — **Installation**, **Identification**, **Event Capture** — but the report must not hard-code that list; render whatever areas appear.

For each area, write a one-paragraph framing immediately under the area heading, then the table. Use the canonical copy below verbatim when the area name matches; otherwise write a one-sentence summary derived from the area's check labels.

## Report shape

```markdown
# PostHog Audit Report

## Summary

<the Summary body — see the template below>

## Recommended actions

<the numbered list of actions, or `_Nothing to fix._`>

## Full audit

<per-area headings + paragraphs + tables + blind spots, in ledger order>

## About this audit

The PostHog wizard runs a five-stage chain: SDK installation → init correctness → identification → event capture → this report. Each stage resolves one or more checks against the project's source tree, recording every result — pass or otherwise — in the ledger this report was generated from.

- `error` items break correctness now (events lost, identity broken). Fix first.
- `warning` items work today but cause subtle data-quality bugs. Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside.

Re-run `posthog-wizard audit` after applying fixes to refresh the ledger.
```

## Section body templates

### Summary body

```markdown
[1–2 sentence overview: runtimes covered (client/server/both), overall health, and which areas had issues.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Installation | [label] | [file:line] | [details] |
```

If there are no problematic items, replace the table with `_No issues found — your PostHog setup looks healthy._`.

### Recommended actions body

Numbered list, ordered by severity (errors → warnings → suggestions), then by ledger order within a severity. Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the data-quality consequence: which downstream artifact (funnels, retention, person count, billing, replays, experiments, etc.) this finding contaminates if left alone, and how. Use the canonical "why it matters" copy below verbatim when the check id matches; otherwise write one sentence rooted in the check's rule.
3. **How to fix** — one short imperative sentence pointing at `file:line` and the concrete change. End with a docs link.

Format:

```markdown
1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).
```

If there are no actions, write `_Nothing to fix._`.

### Full audit body

For each `area` from the ledger, in first-seen order:

```markdown
### [Area from ledger]

[Canonical paragraph for the area, see "Canonical area copy" below. If the area is not in the canonical list, write one short sentence summarizing what its checks verify.]

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

#### Assumptions and blind spots

[Per the investigation standards in `posthog-best-practices/references/investigation-standards.md`, standard 3. ≤4 sentences answering: which code paths were not checked, which runtime assumptions are unproven by static code, what alternative explanations exist for the patterns found, and what to verify in the live PostHog project to confirm the most important findings. When the area produced only `pass` rows, write `_No findings to qualify; the standard checks for this area passed cleanly._` instead.]
```

## Publish the report

Once every placeholder in `.posthog-wizard-cache/audit-report.md` has been replaced, `Read` the finished file and call `publish_handoff` once with its exact contents as `content`:

```
publish_handoff({ "content": "<the full report markdown>" })
```

Pass the report verbatim, not a summary of it, and do not trim sections to make the call smaller. That one call is the whole handoff: the tool stores the report on the wizard session, creates a PostHog notebook from it so the reader can comment on it and link to it from insights, and surfaces the notebook URL in the wizard outro.

Then remove the scratch file — the notebook is the copy that lasts:

```
Bash: rm -f .posthog-wizard-cache/audit-report.md
```

### Resolve `write-report` and `upload-notebook`, then clean up

Both rows describe the same published report, so resolve them together once the `publish_handoff` call has gone through:

- `publish_handoff` succeeded → both rows `pass`.
- `publish_handoff` errored → both rows `warning`, `details: "Report publish failed: <short reason>"`. Don't retry.

```json
{
  "updates": [
    { "id": "write-report", "status": "pass" },
    { "id": "upload-notebook", "status": "pass" }
  ]
}
```

Resolve both ids even though one report now covers both — the wizard seeds them both, and `audit_resolve_checks` rejects ids it doesn't know while leaving unresolved rows pending in the sidebar.

Then delete the ledger — it's transient scratch state and every row is now resolved:

```
Bash: rm -f .posthog-audit-checks.json
```
