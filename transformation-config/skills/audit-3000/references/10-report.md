---
next_step: null
---

# Step 10 — Create the audit notebook (FULL CONTENT / increment 2)

This step creates the audit notebook inside the customer's PostHog project. The notebook **is** the deliverable — there is no local markdown file.

## File-creation contract

- Do **NOT** write `posthog-audit-report.md` or any markdown report at the project root.
- Do **NOT** write any sidecar JSON, CSV, notes, or summary file at the project root.
- The only file you may write outside the project root is `/tmp/posthog-notebook-url.txt` (wizard reads and deletes it).
- Do **NOT** leave `/tmp/posthog-enrichment-staged.md`, `/tmp/posthog-use-case-match.json`, `/tmp/co.json`, `/tmp/pe.json`, or `.posthog-audit-checks.json` behind — delete them all in step 8.

If at the end of this step you have written more than `/tmp/posthog-notebook-url.txt` outside the project root, you have done it wrong.

## Status

Emit:

```
[STATUS] Creating audit notebook
```

## Action

### 1. Read the ledger and resolve phase markers

`Read` `.posthog-audit-checks.json` — the source of truth for every finding. Resolve the three phase-marker checks (`Wrap-up & notebook` area, ids `customer-enrichment`, `use-case-match`, `final-report`) with one `mcp__wizard-tools__audit_resolve_checks` call:

- `customer-enrichment` → `pass` if `/tmp/posthog-enrichment-staged.md` exists, else `suggestion` (`details`: `"Skipped — set HARMONIC_API_KEY (and optionally PDL_API_KEY) in the environment to enable customer enrichment."`).
- `use-case-match` → `pass` if `/tmp/posthog-use-case-match.json` exists AND its `"skipped"` field is `false`, else `suggestion` (`details`: `"Skipped — depends on customer enrichment."` or `"Skipped — low confidence."`).
- `final-report` → `pass`.

### 2. Read optional context

If they exist, `Read`:

- `/tmp/posthog-enrichment-staged.md` — customer enrichment summary.
- `/tmp/posthog-use-case-match.json` — recommended PostHog use cases for this customer.

These inform the TL;DR and Top 3 actions. They are not rendered verbatim.

### 3. Derive the title

Format: `PostHog Audit — <name> — <YYYY-MM-DD>`.

- `<name>`: `Bash` once → `basename "$(pwd)"`.
- `<YYYY-MM-DD>`: `Bash` once → `date -u +%Y-%m-%d`.

Fallback if either bash call fails: `PostHog Audit — <YYYY-MM-DD>`.

### 4. Build the ProseMirror document

The notebook must read like a consultant's deliverable — clear, structured, prioritized — NOT like agent output.

#### Writing rules (non-negotiable)

1. **No agent jargon.** Never write "check passed", "ledger", "step", "skill", "audit ran", "the agent found". Write as the report's author.
2. **Customer-facing language.** "Stack consolidation" not "expansion". "Session recordings" not "session replay events". "The team" / "you" — not "the customer".
3. **Concrete numbers over adjectives.** "47 of 312 events fire fewer than 5 times" beats "many events are low-volume".
4. **Lead with impact, not mechanism.** "Users in test environments inflate your replay bill" beats "PostHog SDK initializes in CI".
5. **≤3 sentences per paragraph.** Active voice.
6. **No emojis.** One ✔ in the TL;DR is fine; nothing else.
7. **No status references.** Never write "status: pass" or "this is flagged as suggestion". Translate the ledger into prose.

#### Document structure (in this order)

1. **Title** — H1.
2. **TL;DR** — one paragraph.
3. **Top 3 actions** — H2 + `orderedList` of exactly 3 items.
4. **What's working well** — H2 + `bulletList` of 3–6 items.
5. **Findings by area** — H2, then one H3 per area with findings underneath.
6. **Appendix** — H2 + `bulletList` of doc links.

#### Section specs

**TL;DR.** One paragraph, 2–3 sentences:
- Headline state (one of: "solid foundation", "mostly working with gaps", "significant work needed").
- Biggest opportunity in customer-value terms.
- (Optional) the single most important next step.

**Top 3 actions.** `orderedList` of exactly 3 items. Each item is one paragraph shaped exactly:

- **Action title** (bold) — short imperative.
- " — Why: " + one sentence on impact.
- " · Effort: " + one of `S`, `M`, `L`.

Pick by highest impact-to-effort ratio across all `fail` and `suggestion` items in the ledger. Rank, don't just take the first three.

**What's working well.** `bulletList` of 3–6 items. One sentence each, framed as customer value. Drawn from `pass` items.

**Findings by area.** One H3 per area in this order:

1. Installation
2. Identification
3. Event Capture
4. Event Quality
5. Feature Flags
6. Session Replay
7. Session Replay — Optimize
8. Stack consolidation
9. Wrap-up & notebook

Skip an area entirely if every check inside is `pass` AND there's nothing useful to add. Otherwise produce 1–4 findings per area. Each finding is one paragraph shaped exactly:

- **Finding title** (bold) — short noun phrase.
- " Observation: " + one concrete sentence (use numbers from the ledger `details` when available).
- " Why it matters: " + one sentence on user/business impact.
- " Recommendation: " + one actionable sentence.

If the ledger entry has a `details` field, mine it for numbers and specifics — never paste it verbatim.

**Appendix.** `bulletList` of links — only for areas you wrote findings about:

- Installation: https://posthog.com/docs/getting-started/install
- Identification: https://posthog.com/docs/data/identify
- Event capture: https://posthog.com/docs/data/events
- Event quality: https://posthog.com/docs/product-analytics/best-practices
- Feature flags: https://posthog.com/docs/feature-flags/best-practices
- Session replay: https://posthog.com/docs/session-replay/installation
- Stack consolidation: https://posthog.com/docs

#### ProseMirror node reference

`heading`:

```json
{ "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "..." }] }
```

`paragraph` with bold + plain text:

```json
{
  "type": "paragraph",
  "content": [
    { "type": "text", "text": "Standardize event naming", "marks": [{ "type": "bold" }] },
    { "type": "text", "text": " — Why: drift in event names blocks reliable funnels. · Effort: M" }
  ]
}
```

`bulletList` (use `orderedList` with same shape for Top 3 actions):

```json
{
  "type": "bulletList",
  "content": [
    { "type": "listItem", "content": [
      { "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }
    ]}
  ]
}
```

#### Worked mini-example (top of doc only — you must produce all sections in full)

```json
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "PostHog Audit — hogflix-project — 2026-06-02" }] },

    { "type": "paragraph",
      "content": [{ "type": "text", "text": "Your PostHog integration is mostly working, with solid identification and capture. The biggest opportunity is tightening event hygiene — about 15% of your events fire fewer than 5 times, which makes funnels and dashboards harder to trust. Start with standardizing event names." }] },

    { "type": "heading", "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Top 3 actions" }] },

    { "type": "orderedList", "content": [
      { "type": "listItem", "content": [
        { "type": "paragraph", "content": [
          { "type": "text", "text": "Standardize event naming", "marks": [{ "type": "bold" }] },
          { "type": "text", "text": " — Why: mixed casing and verb forms across 312 events make funnels brittle. · Effort: M" }
        ]}
      ]}
    ]},

    { "type": "heading", "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "What's working well" }] },

    { "type": "bulletList", "content": [
      { "type": "listItem", "content": [
        { "type": "paragraph", "content": [
          { "type": "text", "text": "Users are reliably identified across sessions, so your funnels and cohorts trust the same person." }
        ]}
      ]}
    ]},

    { "type": "heading", "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Findings by area" }] },

    { "type": "heading", "attrs": { "level": 3 },
      "content": [{ "type": "text", "text": "Event Quality" }] },

    { "type": "paragraph", "content": [
      { "type": "text", "text": "Duplicate page-view events", "marks": [{ "type": "bold" }] },
      { "type": "text", "text": " Observation: both $pageview and a custom \"page_viewed\" fire on every route change. Why it matters: insights split across two events under-count engagement by roughly half. Recommendation: standardize on $pageview and remove the custom event from your router." }
    ]}
  ]
}
```

Produce the full document — this example shows only the top.

### 5. Create the notebook

PostHog MCP tools are deferred. Load the schema first:

```
ToolSearch({ query: "select:mcp__posthog-wizard__notebooks-create", max_results: 1 })
```

Then call `mcp__posthog-wizard__notebooks-create` with:

- `title`: the title from step 3 (max 256 chars).
- `content`: the full ProseMirror doc from step 4 (the entire object — do NOT stringify).
- `text_content`: `null`.
- `version`: `0`.
- `deleted`: `false`.

Response fields that matter: `short_id`, `_posthogUrl`. Save `_posthogUrl`.

### 6. Hand the URL off to the wizard

`Write` `/tmp/posthog-notebook-url.txt` containing only `_posthogUrl` (no trailing newline, no quotes, no other text).

If `mcp__posthog-wizard__notebooks-create` failed, do NOT write the file. Emit:

```
[ERROR] Notebook creation failed: <one-line reason>
```

…and continue to step 8 (cleanup). No markdown fallback — fail loud.

### 7. Emit the canonical signal line

If created successfully, emit exactly one line:

```
Created notebook: <_posthogUrl>
```

### 8. Cleanup

One `Bash` call:

```
rm -f /tmp/posthog-enrichment-staged.md /tmp/posthog-use-case-match.json /tmp/co.json /tmp/pe.json .posthog-audit-checks.json
```

Do NOT delete `/tmp/posthog-notebook-url.txt` — the wizard owns its lifecycle.
