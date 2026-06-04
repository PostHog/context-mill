---
next_step: null
---

# Step 5 — Generate the audit report (and upload it to a notebook)

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded ends up in the report, even passes; nothing is invented. After the markdown is written to disk, this step also writes the report into a PostHog notebook so it's shareable from inside PostHog.

## Status

Emit, in order:

```
[STATUS] Writing audit report
[STATUS] Uploading report to notebook
```

## MCP tools

| MCP tool | When | Use |
|----------|------|-----|
| `mcp__posthog-wizard__notebooks-create` | "Upload to a PostHog notebook" below | Write the markdown report into a PostHog notebook (note the trailing `s` in `notebooks`). |

Load it via `ToolSearch select:mcp__posthog-wizard__notebooks-create` once, right before the upload sub-step — not at the top, so step 5 stays cheap when MCP isn't needed yet. `mcp__wizard-tools__audit_resolve_checks` is already loaded — you'll use it again after the upload.

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-report.md` at the project root with the structure shown below. **Do not delete `.posthog-audit-checks.json` yet** — the notebook-upload sub-step still resolves a ledger row. The cleanup happens at the very end of this step.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes with `file:line` and a docs link per item.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — a short closing block explaining what the audit covered and how to interpret the report.

For the Full audit section, group rows dynamically by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. Today the core audit produces three areas — **Installation**, **Identification**, **Event Capture** — but the report must not hard-code that list; render whatever areas appear.

For each area, write a one-paragraph framing immediately under the area heading, then the table. Use the canonical copy below verbatim when the area name matches; otherwise write a one-sentence summary derived from the area's check labels.

## Report template

<wizard-report>
# PostHog Audit Report

## Summary

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

If there are no problematic items, write `_No issues found — your PostHog setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by ledger order within a severity. Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the data-quality consequence: which downstream artifact (funnels, retention, person count, billing, replays, experiments, etc.) this finding contaminates if left alone, and how. Use the canonical "why it matters" copy below verbatim when the check id matches; otherwise write one sentence rooted in the check's rule.
3. **How to fix** — one short imperative sentence pointing at `file:line` and the concrete change. End with a docs link.

Format:

1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).

If there are no actions, write `_Nothing to fix._`.

## Full audit

### [Area from ledger]

[Canonical paragraph for the area, see "Canonical area copy" above. If the area is not in the canonical list, write one short sentence summarizing what its checks verify.]

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

[Repeat the heading + paragraph + table for each area in ledger order.]

## About this audit

The PostHog wizard runs a five-stage chain: SDK installation → init correctness → identification → event capture → this report. Each stage resolves one or more checks against the project's source tree, recording every result — pass or otherwise — in the ledger this report was generated from.

- `error` items break correctness now (events lost, identity broken). Fix first.
- `warning` items work today but cause subtle data-quality bugs. Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside.

Re-run `posthog-wizard audit` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-report.md>
```

## Upload to a PostHog notebook

The markdown report on disk is the source of truth. The notebook is a shareable, in-PostHog mirror so the reader can comment, link to it from insights, and discuss it without leaving the product.

### Re-read the finished report

`Read` `posthog-audit-report.md` once. This is the content you'll translate into the notebook — using the on-disk file (instead of regenerating from the ledger) guarantees the notebook matches what the user sees in the file.

### Translate markdown → ProseMirror JSON

**The `content` argument to `notebooks-create` is ProseMirror JSON, not markdown.** Passing markdown renders as plain text and tables don't work. Pass `content` as `{"type": "doc", "content": [ ...nodes ]}`. Build the node array by walking the markdown report once, in order, and emitting the matching ProseMirror node for each block.

Node mapping:

| Markdown | ProseMirror node |
|---|---|
| `# / ## / ### heading` | `{"type":"heading","attrs":{"level":<N>},"content":[{"type":"text","text":"<heading text>"}]}` |
| paragraph | `{"type":"paragraph","content":[{"type":"text","text":"<...>"}]}` |
| bulleted list | `{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"<item>"}]}]}, ...]}` |
| numbered list | `{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"<item>"}]}]}, ...]}` |
| inline `code` | text node with a `code` mark: `{"type":"text","marks":[{"type":"code"}],"text":"<code>"}` |
| `**bold**` | text node with a `bold` mark |
| `[label](url)` | text node with a `link` mark: `{"type":"text","marks":[{"type":"link","attrs":{"href":"<url>"}}],"text":"<label>"}` |
| pipe table (the Summary's "Problematic items" and Full-audit per-area tables) | `{"type":"table","content":[ <tableRow>, ... ]}` — every cell wraps text in a paragraph. First row uses `tableHeader`; remaining rows use `tableCell`. **Do not paste the pipe-table markdown directly — it renders as raw text.** |

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

### Call `notebooks-create`

```json
{
  "title": "PostHog audit (wizard) – <repo_name> – <timestamp>",
  "text_content": "<plain-text version of posthog-audit-report.md — used for PostHog search>",
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
      {"type":"paragraph","content":[{"type":"text","text":"<1–2 sentence overview from the report>"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[
          {"type":"text","marks":[{"type":"bold"}],"text":"Errors: "},
          {"type":"text","text":"<N>"}
        ]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[
          {"type":"text","marks":[{"type":"bold"}],"text":"Warnings: "},
          {"type":"text","text":"<N>"}
        ]}]}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Recommended actions"}]},
      {"type":"orderedList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[
          {"type":"text","marks":[{"type":"bold"}],"text":"[Area] · [label] — "},
          {"type":"text","text":"<what's wrong>. <why it matters>. Fix at "},
          {"type":"text","marks":[{"type":"code"}],"text":"file:line"},
          {"type":"text","text":". See "},
          {"type":"text","marks":[{"type":"link","attrs":{"href":"<docs url>"}}],"text":"docs"},
          {"type":"text","text":"."}
        ]}]}
      ]}
    ]
  }
}
```

- `title` is short, scannable, and includes the repo name, the audit date, and the literal `(wizard)` tag so future notebook searches can find every wizard-created artifact at once. Keep the casing exact.
- `text_content` is the plain-text body (strip markdown formatting). Used for PostHog search; never seen as-is by the reader.
- `content` is the ProseMirror tree above, built by walking the report's sections in order. Include every section the report has — Summary, Recommended actions, Full audit (per-area), About this audit.

### Surface the notebook URL

Capture the returned notebook `short_id` and `url`. Emit a single line on its own (no quotes, no code fence):

```
[NOTEBOOK_URL] <full PostHog notebook URL from notebooks-create>
```

The wizard scans for the literal marker `[NOTEBOOK_URL]` and stores the URL that follows.

### Failure handling

If `notebooks-create` errors (permission denied, project misconfigured, network, MCP unavailable), emit one line — `Notebook upload failed: <short reason>. The local report at posthog-audit-report.md is still the source of truth.` — and continue to the resolve sub-step. Don't retry. Don't fall back to a different shape. Do not emit `[NOTEBOOK_URL]` on failure.

### Resolve `upload-notebook` and clean up

Flip the `upload-notebook` row based on outcome:

- Notebook created → status `pass`, `file` set to the notebook URL.
- `notebooks-create` errored → status `warning`, `details: "Notebook upload failed: <short reason>"`.
- MCP unavailable → status `suggestion`, `details: "Skipped — PostHog MCP unavailable"`.

```json
{
  "updates": [
    { "id": "upload-notebook", "status": "pass", "file": "<full notebook URL>" }
  ]
}
```

Then delete the ledger — it's transient scratch state and all 11 rows are now resolved:

```
Bash: rm -f .posthog-audit-checks.json
```
