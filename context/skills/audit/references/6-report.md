---
next_step: null
---

# Step 6 — Generate the audit report (and upload it to a notebook)

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check in the ledger ends up in the report, even passes; nothing is invented. That includes the rows the live-data step appended from PostHog's own findings, which arrive at runtime rather than from the wizard's seed. After the markdown is written to disk, this step also writes the report into a PostHog notebook so it's shareable from inside PostHog.

## Status

Emit, in order:

```
[STATUS] Writing audit report
[STATUS] Building notebook payload
[STATUS] Uploading report to notebook
```

## MCP tools

{{> mcp-tool-calling}}

| MCP tool | When | Use |
|----------|------|-----|
| `notebooks-create-markdown` | (a) of "Upload to a PostHog notebook" | Create the notebook with a `title` and the report's opening sections as `markdown`. One call. |
| `notebooks-add-cell` | (b) of "Upload to a PostHog notebook" | Append one remaining report section per call as a markdown cell (`cell_type: "markdown"`). Called once per section — required because the model can't emit the full report in a single tool_use input; it self-truncates. |
| `notebooks-get` | (c) of "Upload to a PostHog notebook" | Read the cloud notebook back to verify every report section arrived. |

Run `info <tool>` on each of these before its first `call`, right before the upload sub-step. `mcp__wizard-tools__audit_resolve_checks` is already loaded — you'll use it again after the upload.

If `info notebooks-add-cell` returns a not-found error, the notebook tools aren't available in this project. Skip the notebook-upload sub-step entirely; emit `Notebook upload skipped: notebooks-add-cell unavailable. The local report at posthog-audit-report.md is still the source of truth.` and resolve `upload-notebook` to `suggestion` with that reason.

## Action

`Read` the ledger once, then build the report **incrementally** — `Write` a skeleton with placeholder markers, then `Edit` each placeholder with its real section in a separate turn. **Do not compose the whole report in one turn.** A single sustained generation of the full document routinely drops the LLM streaming connection around the 10-minute mark; chunking via Write + Edit keeps every turn short and resets the SSE timer at each tool call. The on-disk file is the source of truth, so a dropped turn loses at most one section, not the whole report.

**Do not delete `.posthog-audit-checks.json` yet** — the notebook-upload sub-step still resolves a ledger row. The cleanup happens at the very end of this step.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes with `file:line` and a docs link per item. Rows with no `file` (everything from the live-data step — those findings come from ingested data, not a line of source) simply omit the location; don't invent one, and don't go looking for it.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — a short closing block explaining what the audit covered and how to interpret the report. *Static text — already baked into the skeleton.*

For the Full audit section, group rows dynamically by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. **Render whatever areas appear — never hard-code the list**, and never assume a count. The **Live Data** area in particular varies per project: the live-data step appends a row per open finding, so a healthy project has one row there and a neglected one has eight.

For each area, write a one-paragraph framing immediately under the area heading, then the table. Use the canonical copy below verbatim when the area name matches; otherwise write a one-sentence summary derived from the area's check labels.

### a. Write the skeleton

One `Write` to `posthog-audit-report.md` with section headings and HTML-comment placeholders for the body of each non-static section. The About-this-audit text is identical every run, so it's baked in directly.

```markdown
# PostHog Audit Report

## Summary

<!-- SECTION_SUMMARY -->

## Recommended actions

<!-- SECTION_RECOMMENDED_ACTIONS -->

## Full audit

<!-- SECTION_FULL_AUDIT -->

## About this audit

The PostHog wizard runs this audit in stages: SDK installation → init correctness → identification → event capture → live data → this report. The early stages resolve checks against the project's source tree. The live-data stage reads what PostHog already computed from your ingested data — things no source scan can see, like whether stack frames actually resolve. Every result, pass or otherwise, is recorded in the ledger this report was generated from.

- `error` items break correctness now (events lost, identity broken). Fix first.
- `warning` items work today but cause subtle data-quality bugs. Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside.

Re-run `posthog-wizard audit` after applying fixes to refresh the ledger.
```

This Write should be small — just the structure above. Don't compose section bodies yet.

### b. Fill the Summary section

One `Edit`:

- `old_string`: `<!-- SECTION_SUMMARY -->`
- `new_string`: the Summary body — one-paragraph overview, then the counts list, then the problematic-items table (or the "no issues" line). See the Summary template below for the exact shape.

Output for this turn is bounded by the Summary content alone (~500 tokens for most projects).

### c. Fill the Recommended actions section

One `Edit`:

- `old_string`: `<!-- SECTION_RECOMMENDED_ACTIONS -->`
- `new_string`: the numbered list of actions in the format below, or `_Nothing to fix._` if there are none.

### d. Fill the Full audit section

One `Edit`:

- `old_string`: `<!-- SECTION_FULL_AUDIT -->`
- `new_string`: the per-area headings + paragraphs + tables + per-area `#### Assumptions and blind spots` subsection, in ledger order. The blind-spots subsection lives directly under each area's table, following the per-area body template below.

If the Full audit section is large (many areas, many checks), you may split it across multiple Edits by including per-area placeholders in the original skeleton and filling each with one Edit. Most audits fit in one Edit.

## Section body templates

Use these shapes when computing the `new_string` for each Edit above.

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

### Canonical area copy

Use these paragraphs verbatim as the area framing, both in the markdown report and in the notebook's `__FULL_AUDIT_<AREA>_PARAGRAPH__` nodes. Match on the ledger's `area` value. For an area not listed here, write one short sentence summarizing what its checks verify.

- **Installation** — Whether the PostHog SDK is present, current, and initialized the way the framework expects. Everything downstream depends on this: a missing or stale SDK silently changes which events exist and which config options are honoured.
- **Identification** — Whether the same human maps to one stable `distinct_id` across sessions, runtimes, and logins. Identity defects are the most expensive kind to fix after the fact, because they corrupt person counts, funnels, and retention retroactively rather than going forward.
- **Event Capture** — Whether events are named consistently, reach PostHog reliably, and cover the moments the business actually reasons about. Gaps here don't break anything visibly; they just leave the questions you want to ask unanswerable.
- **Live Data** — What PostHog itself has already flagged for this project, read from its recommendations and health checks. These come from ingested data rather than source code, so they catch problems no static scan can see — stack frames that never resolve, syncs that keep failing, alerts nobody wired up.

For **Live Data**, the "Assumptions and blind spots" subsection has a standing caveat worth stating: these findings reflect what PostHog has observed in the recent lookback window, so a project that has just started sending data, or one whose findings haven't been recomputed yet, can show a clean area without being clean.

After the report is written, emit a line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-report.md>
```

### Resolve `write-report`

Flip the `write-report` row to `pass` now that the markdown file exists on disk. The notebook-upload sub-step that follows can take a while (large ProseMirror payload), and resolving this row first lets the wizard sidebar advance to "Upload notebook" so the user can see what's happening.

```json
{
  "updates": [
    { "id": "write-report", "status": "pass" }
  ]
}
```

## Upload to a PostHog notebook

The markdown report on disk is the source of truth. The notebook is a shareable, in-PostHog mirror so the reader can comment, link to it from insights, and discuss it without leaving the product.

### Why two MCP tools instead of one

The notebook stores markdown natively, and the report on disk already is markdown — the upload is a verbatim copy, not a translation. The one constraint is output budget: the assistant turn that emits a tool_use has to *generate its argument as output tokens*, even when it's just copying from a file it just read, and a 12-check audit report is past the per-turn output budget for some runs. The model self-truncates and the notebook ships with sections missing.

The fix is to **build the cloud notebook incrementally**. `notebooks-create-markdown` carries the title and the report's opening sections; then `notebooks-add-cell` appends one section per call as a markdown cell. Each call's input is bounded — one section — so it always fits in one turn. The notebook is complete only after the last append lands.

There's no local notebook payload scratch file and no translation step in this design. Section content comes verbatim from the on-disk report.

### Orientation: re-read the report

`Read` `posthog-audit-report.md` once. Its sections go into the calls below verbatim — copy each section from disk as you send it; don't re-compose from memory.

### a. Create the notebook with the report's head

**One** `notebooks-create-markdown` call. The `title` becomes the notebook's leading `# heading`, so the `markdown` starts below it: the mirror line, then the Summary section verbatim (overview, counts, problematic-items table).

```json
{
  "title": "PostHog audit (wizard) – <repo_name> – <timestamp>",
  "markdown": "Mirror of `posthog-audit-report.md` generated by the audit skill on <timestamp>.\n\n## Summary\n\n<the report's Summary section, verbatim>"
}
```

Substitute `<repo_name>` and `<timestamp>` literally before sending.

Capture the returned `short_id` and URL. **Hold them; do not emit `[NOTEBOOK_URL]` yet.** The notebook exists in PostHog Cloud at this point but most report sections are still missing. The marker fires only after every append in (b) succeeds and (c) verifies the cloud notebook is complete.

If `notebooks-create-markdown` errors (permission denied, project misconfigured, network, MCP unavailable), emit one line — `Notebook upload failed at notebooks-create-markdown: <short reason>. The local report at posthog-audit-report.md is still the source of truth.` — and skip to the resolve sub-step with `upload-notebook` resolved per the matrix below. Don't retry. Don't emit `[NOTEBOOK_URL]`.

### b. Append the remaining sections with `notebooks-add-cell`

One call per remaining top-level section of the report, in the report's order — Recommended actions, Full audit (all areas with their tables and blind-spot notes), About this audit:

```json
{
  "notebook_id": "<short_id from (a)>",
  "cell_type": "markdown",
  "markdown": "## Recommended actions\n\n<the section verbatim from the report, starting at its heading>"
}
```

If the Full audit section is large (many areas), split it into one call per area — each starting at the area's `###` heading. Every check row from the ledger ships; do not subset.

Pace the appends one per turn, sequential — cells default to the end of the document, so parallel calls can land out of order. If one call errors, run `notebooks-get` to see what actually landed, then re-send just the missing section.

### c. Verify the notebook is complete

**Required step. Do not skip.** After the last append, call `notebooks-get` with the `short_id`. In the returned `markdown`, check that every `##` (and per-area `###`) heading of the on-disk report appears.

Expected: **every section present**. If one is missing, its append never landed — re-send it, then re-get and re-verify until complete.

A missing section renders as a hole in the notebook UI. The check is cheap; skipping it is the failure mode we've observed in the events-audit twin of this flow.

### d. Surface the notebook URL

**Only emit `[NOTEBOOK_URL]` after (c) verifies the notebook is complete.** Until then the notebook is missing sections in PostHog Cloud — exactly the half-baked state we don't want the user to see.

Emit a single line on its own (no quotes, no code fence):

```
[NOTEBOOK_URL] <url captured in (a)>
```

The wizard scans for the literal marker `[NOTEBOOK_URL]` and stores the URL that follows. It only consumes the URL once, the first time it sees the marker.

### e. Resolve `upload-notebook` and clean up

Flip the `upload-notebook` row based on outcome:

- Notebook created and complete (every `notebooks-add-cell` succeeded, (c) verified complete) → status `pass`, `file` set to the notebook URL.
- `notebooks-create-markdown` errored → status `warning`, `details: "Notebook upload failed at notebooks-create-markdown: <short reason>"`. URL marker not emitted.
- Some `notebooks-add-cell` calls failed, leaving sections missing from the cloud notebook → status `warning`, `details: "Notebook partially uploaded: <N> of <total> sections landed"`. URL marker not emitted (the notebook is half-baked).
- `notebooks-add-cell` unavailable or MCP unavailable → status `suggestion`, `details: "Skipped — <short reason>"`. URL marker not emitted.

```json
{
  "updates": [
    { "id": "upload-notebook", "status": "pass", "file": "<full notebook URL>" }
  ]
}
```

Then delete the ledger — it's transient scratch state and every row is now resolved:

```
Bash: rm -f .posthog-audit-checks.json
```
