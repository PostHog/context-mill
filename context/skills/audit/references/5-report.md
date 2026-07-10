---
next_step: null
---

# Step 5 — Generate the audit report (and upload it to a notebook)

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded ends up in the report, even passes; nothing is invented. After the markdown is written to disk, this step also writes the report into a PostHog notebook so it's shareable from inside PostHog.

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
| `notebooks-create` | (a) of "Upload to a PostHog notebook" | Create the notebook with a small placeholder skeleton (title + section headings + placeholder paragraphs). One call. |
| `notebook-edit` | (b) of "Upload to a PostHog notebook" | Replace one placeholder paragraph in the cloud notebook with a real ProseMirror node. **Called many times** (one per placeholder). Required because the model can't emit the full assembled tree in a single `notebooks-create` tool_use input — it self-truncates. |
| `notebooks-retrieve` | (c) of "Upload to a PostHog notebook" | Read the cloud notebook back to verify every placeholder has been replaced. |

Run `info <tool>` on each of these before its first `call`, right before the upload sub-step. `mcp__wizard-tools__audit_resolve_checks` is already loaded — you'll use it again after the upload.

If `info notebook-edit` returns a not-found error, the project's `notebooks-collaboration` feature flag isn't enabled. Skip the notebook-upload sub-step entirely; emit `Notebook upload skipped: notebook-edit unavailable. The local report at posthog-audit-report.md is still the source of truth.` and resolve `upload-notebook` to `suggestion` with that reason.

## Action

`Read` the ledger once, then build the report **incrementally** — `Write` a skeleton with placeholder markers, then `Edit` each placeholder with its real section in a separate turn. **Do not compose the whole report in one turn.** A single sustained generation of the full document routinely drops the LLM streaming connection around the 10-minute mark; chunking via Write + Edit keeps every turn short and resets the SSE timer at each tool call. The on-disk file is the source of truth, so a dropped turn loses at most one section, not the whole report.

**Do not delete `.posthog-audit-checks.json` yet** — the notebook-upload sub-step still resolves a ledger row. The cleanup happens at the very end of this step.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes with `file:line` and a docs link per item.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — a short closing block explaining what the audit covered and how to interpret the report. *Static text — already baked into the skeleton.*

For the Full audit section, group rows dynamically by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. Today the core audit produces three areas — **Installation**, **Identification**, **Event Capture** — but the report must not hard-code that list; render whatever areas appear.

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

The PostHog wizard runs a five-stage chain: SDK installation → init correctness → identification → event capture → this report. Each stage resolves one or more checks against the project's source tree, recording every result — pass or otherwise — in the ledger this report was generated from.

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

Earlier versions of this skill called `notebooks-create` once with the full assembled ProseMirror tree as the `content` argument. The assistant turn that emits that tool_use has to *generate the tree as output tokens*, even if it's just copying from a file it just read. For a 12-check audit with tables and bullet lists the full tree is several thousand tokens — past the per-turn output budget for some runs. The model self-truncates and the notebook ships with sections missing.

The fix is to **build the cloud notebook incrementally**. `notebooks-create` carries only a small skeleton (title + section headings + placeholder paragraphs). Then `notebook-edit` replaces one placeholder paragraph at a time with the real ProseMirror node. Each `notebook-edit` tool_use input is bounded — never more than one block-level node — so it always fits in one turn. The notebook is complete only after the last edit lands.

There's no local notebook payload scratch file in this design. Section content is computed on demand from the ledger and the on-disk report.

### Orientation: re-read the report

`Read` `posthog-audit-report.md` once. You'll use it as a reference for what content to send in each edit. Don't translate the whole thing up front — translate per placeholder, as you fill each one.

### Node mapping (apply per placeholder as you `notebook-edit`)

| Markdown | ProseMirror node |
|---|---|
| `# / ## / ### heading` | `{"type":"heading","attrs":{"level":<N>},"content":[{"type":"text","text":"<heading text>"}]}` |
| paragraph | `{"type":"paragraph","content":[{"type":"text","text":"<...>"}]}` |
| bulleted list | `{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"<item>"}]}]}, ...]}` |
| numbered list | `{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"<item>"}]}]}, ...]}` |
| inline `code` | text node with a `code` mark: `{"type":"text","marks":[{"type":"code"}],"text":"<code>"}` |
| `**bold**` | text node with a `bold` mark |
| `[label](url)` | text node with a `link` mark: `{"type":"text","marks":[{"type":"link","attrs":{"href":"<url>"}}],"text":"<label>"}` |
| pipe table | `{"type":"table","content":[ <tableRow>, ... ]}` — every cell wraps text in a paragraph. First row uses `tableHeader`; remaining rows use `tableCell`. |

Table example (mirrors the report's "Problematic items" table):

```json
{"type":"table","content":[
  {"type":"tableRow","content":[
    {"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Severity"}]}]},
    {"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Area"}]}]},
    {"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Check"}]}]},
    {"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"File"}]}]}
  ]},
  {"type":"tableRow","content":[
    {"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"code"}],"text":"error"}]}]},
    {"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Installation"}]}]},
    {"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"init-correct"}]}]},
    {"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"code"}],"text":"app/layout.tsx:14"}]}]}
  ]}
]}
```

### a. Create the notebook with a placeholder skeleton

**One** `notebooks-create` call. The `content` is small — title + intro + section heading nodes + one placeholder paragraph per block-level node you'll later fill. Every placeholder text must be a unique string (the verification + edits depend on uniqueness).

`notebook-edit` replaces **one node** with **one node** — so each block-level part of a section needs its own placeholder. A Full-audit area that renders as `heading + paragraph + table` needs THREE placeholders. Plan the placeholder count from the ledger before sending.

For a typical doctor deliverable the placeholder set is:

| Region | Placeholders | Count |
|---|---|---|
| Summary | `__SUMMARY_OVERVIEW__` (one paragraph), `__SUMMARY_COUNTS__` (one bulletList), `__SUMMARY_PROBLEMATIC__` (one table or fallback paragraph) | 3 |
| Recommended actions | `__RECOMMENDED_ACTIONS__` (one orderedList, or fallback paragraph if none) | 1 |
| Full audit per area | `__FULL_AUDIT_<AREA>_HEADING__` (level-3 heading), `__FULL_AUDIT_<AREA>_PARAGRAPH__` (framing paragraph), `__FULL_AUDIT_<AREA>_TABLE__` (per-area table), `__FULL_AUDIT_<AREA>_BLIND_SPOTS_HEADING__` (level-4 heading "Assumptions and blind spots"), `__FULL_AUDIT_<AREA>_BLIND_SPOTS__` (paragraph) | 5 × N (one set per distinct area in the ledger) |
| About this audit | `__ABOUT_PARAGRAPH__`, `__ABOUT_BULLETS__`, `__ABOUT_CLOSING__` | 3 |

Use uppercased, underscored area names (e.g. `INSTALLATION`, `IDENTIFICATION`, `EVENT_CAPTURE`). Build the skeleton with that count and call `notebooks-create`:

```json
{
  "title": "PostHog audit (wizard) – <repo_name> – <timestamp>",
  "text_content": "<plain-text summary, ~1 paragraph, used for PostHog search>",
  "content": {
    "type": "doc",
    "content": [
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"PostHog audit (wizard) – <repo_name>"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Mirror of "},
        {"type":"text","marks":[{"type":"code"}],"text":"posthog-audit-report.md"},
        {"type":"text","text":" generated by the audit skill on <timestamp>."}
      ]},

      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Summary"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__SUMMARY_OVERVIEW__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__SUMMARY_COUNTS__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__SUMMARY_PROBLEMATIC__"}]},

      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Recommended actions"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__RECOMMENDED_ACTIONS__"}]},

      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Full audit"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_INSTALLATION_HEADING__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_INSTALLATION_PARAGRAPH__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_INSTALLATION_TABLE__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_INSTALLATION_BLIND_SPOTS_HEADING__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_INSTALLATION_BLIND_SPOTS__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_IDENTIFICATION_HEADING__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_IDENTIFICATION_PARAGRAPH__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_IDENTIFICATION_TABLE__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_IDENTIFICATION_BLIND_SPOTS_HEADING__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_IDENTIFICATION_BLIND_SPOTS__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_EVENT_CAPTURE_HEADING__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_EVENT_CAPTURE_PARAGRAPH__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_EVENT_CAPTURE_TABLE__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_EVENT_CAPTURE_BLIND_SPOTS_HEADING__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__FULL_AUDIT_EVENT_CAPTURE_BLIND_SPOTS__"}]},
      // … add five placeholders per additional area in the ledger …

      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"About this audit"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__ABOUT_PARAGRAPH__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__ABOUT_BULLETS__"}]},
      {"type":"paragraph","content":[{"type":"text","text":"__ABOUT_CLOSING__"}]}
    ]
  }
}
```

(Strip the `//` comments before sending — JSON doesn't allow them.)

Substitute `<repo_name>` and `<timestamp>` literally before sending.

Capture the returned `short_id` and `url`. **Hold them; do not emit `[NOTEBOOK_URL]` yet.** The notebook exists in PostHog Cloud at this point but the placeholder paragraphs are still visible. The marker fires only after every edit in (b) succeeds and (c) verifies the cloud notebook is clean.

If `notebooks-create` errors (permission denied, project misconfigured, network, MCP unavailable), emit one line — `Notebook upload failed at notebooks-create: <short reason>. The local report at posthog-audit-report.md is still the source of truth.` — and skip to the resolve sub-step with `upload-notebook` resolved per the matrix below. Don't retry. Don't emit `[NOTEBOOK_URL]`.

### b. Fill each placeholder via `notebook-edit`

For every placeholder in the skeleton, call `notebook-edit` once with:

- `short_id`: the value returned from (a)
- `old_value`: the placeholder paragraph node, exactly as it appears in the skeleton, e.g. `{"type":"paragraph","content":[{"type":"text","text":"__SUMMARY_OVERVIEW__"}]}`
- `new_value`: the real ProseMirror node for that block

The matcher compares `old_value` to subtrees in the notebook by deep equality. Every key matters — `attrs`, `marks`, `content`. Copy the placeholder shape exactly; don't add a `marks` field that wasn't there.

What `new_value` looks like for each placeholder family:

| Placeholder family | `new_value` shape |
|---|---|
| `__SUMMARY_OVERVIEW__` | A single `paragraph` with the 1–2 sentence overview (runtimes covered, overall health). |
| `__SUMMARY_COUNTS__` | A `bulletList` with one item per severity tier: Errors, Warnings, Suggestions, Passes. |
| `__SUMMARY_PROBLEMATIC__` | A `table` with the Severity / Area / Check / File / Details columns. If there are no problematic items, send a single `paragraph` with the italicised "No issues found" line instead. Either way, fill the placeholder. |
| `__RECOMMENDED_ACTIONS__` | An `orderedList` with one `listItem` per action, in severity order. If there are none, send a `paragraph` with the italicised "Nothing to fix" line. |
| `__FULL_AUDIT_<AREA>_HEADING__` | A level-3 `heading` with the area name (e.g. `Installation`). |
| `__FULL_AUDIT_<AREA>_PARAGRAPH__` | A single `paragraph` with the canonical area framing (see "Canonical area copy" below). |
| `__FULL_AUDIT_<AREA>_TABLE__` | A `table` with header row (Check / Status / File / Details) + one row per check in that area, in ledger order. |
| `__ABOUT_PARAGRAPH__` | A single `paragraph` with the canonical opening sentence about the five-stage chain. |
| `__ABOUT_BULLETS__` | A `bulletList` with the three error/warning/suggestion description bullets. |
| `__ABOUT_CLOSING__` | A single `paragraph` with the "Re-run posthog-wizard audit" closing sentence. |

Pace your edits one per turn. Don't bundle multiple `notebook-edit` calls in a single assistant message — each MCP call carries a `version` for optimistic concurrency, and parallel calls will 409 each other. Sequential is correct.

**Error handling per edit:**
- `409 Conflict` or `410 Gone`: the version moved under you. Run `notebooks-retrieve` to refresh, then re-apply the same edit. The server tells you the latest version in the 409 body.
- `0 matches`: `old_value` didn't match exactly. Run `notebooks-retrieve` to dump the current notebook content and compare; the most common cause is a typo in the placeholder text. Fix the `old_value` and retry.
- `Multiple matches`: not expected with unique placeholder strings. If it happens, include more surrounding structure or set `replace_all: true`.

### c. Verify the notebook is clean

**Required step. Do not skip.** After the last `notebook-edit`, call `notebooks-retrieve` with the `short_id`. In the returned `content`, search the text nodes for any remaining `__` markers (e.g. via the agent's own pattern matching of the `JSON.stringify`'d content).

Expected: **zero `__` markers**. If any remain, the agent skipped at least one `notebook-edit` — identify which placeholder(s) survive, run the missing edit(s), then re-retrieve and re-verify until clean.

A leftover placeholder renders as the literal string `__FULL_AUDIT_INSTALLATION_TABLE__` in the notebook UI. The check is cheap; skipping it is the failure mode we've observed in the events-audit twin of this flow.

### d. Surface the notebook URL

**Only emit `[NOTEBOOK_URL]` after (c) verifies the notebook has zero remaining placeholders.** Until then the notebook still has placeholder strings showing in PostHog Cloud — exactly the half-baked state we don't want the user to see.

Emit a single line on its own (no quotes, no code fence):

```
[NOTEBOOK_URL] <url captured in (a)>
```

The wizard scans for the literal marker `[NOTEBOOK_URL]` and stores the URL that follows. It only consumes the URL once, the first time it sees the marker.

### e. Resolve `upload-notebook` and clean up

Flip the `upload-notebook` row based on outcome:

- Notebook created and fully filled (every `notebook-edit` succeeded, (c) verified clean) → status `pass`, `file` set to the notebook URL.
- `notebooks-create` errored → status `warning`, `details: "Notebook upload failed at notebooks-create: <short reason>"`. URL marker not emitted.
- Some `notebook-edit` calls failed, leaving placeholders in the cloud notebook → status `warning`, `details: "Notebook partially uploaded: <N> of <total> placeholders filled; remaining placeholders visible in the notebook"`. URL marker not emitted (the notebook is half-baked).
- `notebook-edit` unavailable (no `notebooks-collaboration` feature flag) or MCP unavailable → status `suggestion`, `details: "Skipped — <short reason>"`. URL marker not emitted.

```json
{
  "updates": [
    { "id": "upload-notebook", "status": "pass", "file": "<full notebook URL>" }
  ]
}
```

Then delete the ledger — it's transient scratch state and all 12 rows are now resolved:

```
Bash: rm -f .posthog-audit-checks.json
```
