---
next_step: 6-dashboard.md
---

# Step 5 – Render the report

Produce the audit deliverable in a single pass. The report has three high-level views the reader scans first — Overview, Volume Map, Area Topology — followed by Identity & Segmentation, suggested follow-ups, and appendices.

The skill's job is to give the reader a map plus a few short observations. **Don't cluster events into flows. Don't write per-flow narratives. Don't synthesize a story.** The reader does that on demand.

## Supporting files

This step uses one supporting reference file (not part of the chain):

- `references/5-report-template.md` — verbatim markdown template for the rendered report. Orchestrator reads it once at step (f), substitutes every `{{placeholder}}`, and writes the result to `posthog-events-audit-report.md`.

## Output discipline

This is one report `Write`, not a write-then-read-then-rewrite cycle. Prior runs read their own freshly-written report 23 seconds after writing it and regenerated it — that wastes ~3 minutes of generation per cycle. Compose the entire Markdown in one model turn, then call `Write` once. If something is wrong with the result, fix it via `Edit` on the same file — don't `Write` it again.

Also: don't recap the inventory contents in assistant text before writing. Stream straight from the inventory you already read into the report.

## Status

Emit, in order:

```
[STATUS] Reading inventory
[STATUS] Computing volume map
[STATUS] Computing area topology
[STATUS] Computing overview KPIs
[STATUS] Analyzing identity & segmentation
[STATUS] Writing report
```

## Action

### a. Read the inventory

`Read` `.posthog-events-inventory.json` once. From it you'll work with:

- `rows[]` – capture rows (sorted by `volume_30d` desc by step 4) with `event_name`, `properties[]`, `package`, `area`, `route`, `enclosing`, `via_wrapper`, `volume_30d`, `last_seen`, `status`, etc.
- `exception_sites[]` – `posthog.captureException(...)` locations collected by step 2. Rendered in the exception-sites appendix.
- `wrapper_aliases[]` – wrapper function names step 2 chased (e.g. `["captureEvent", "track"]`). Empty if none.
- `wrapper_undetected` – top-level boolean.
- `wrapper_likely` – top-level boolean from step 4. `true` triggers the "Wrapper likely undiscovered" Overview panel.
- `mcp_available` – top-level boolean from step 4. `false` means PostHog volume data is missing; render the report in degraded mode (see below).
- `mcp_skipped_reason` – optional short string explaining why MCP was skipped or failed. Used in the disclaimer when `mcp_available: false`.

If `rows[]` is empty, render a short report explaining the inventory is empty, then resolve `write-report` to `pass` and exit.

#### Degraded mode (`mcp_available: false`)

When MCP wasn't reachable in step 4, every row has `volume_30d: null` and `status: "pending"`. Render the report with these adjustments:

- Substitute `{{mcp_disclaimer}}` with a one-paragraph callout (see substitution conventions in (f)). Otherwise leave it empty.
- Volume KPIs in Overview render as `—` instead of numbers: total volume, phantom count, top-10 share. Distinct-events count still renders (it's code-derived).
- Volume Map section: instead of the events table, the body becomes a single line `_PostHog volume data was not fetched during this run — see the disclaimer above. Capture sites are still listed in the Area topology section below._`. Skip the capture-sites subsections too.
- Area Topology section: still renders, but sort areas alphabetically (no volume to sort by) and omit the `<total_volume>` figure from each area heading. Each event bullet shows just the event name plus `· conditional` if applicable; no volume number, no `· phantom` tag.
- Overview panels: skip "Volume concentration" and "Phantom events" entirely (both need volume). All other panels (no-properties, name drift, type drift, conditional fires, duplicate captures, unresolved dynamics) still render — they're code-derived.
- The data-quality findings (rendered as Overview panels) still describe what the code-derived panels found. Don't penalize for missing volume; that's not a code problem.

### b. Aggregate by event (Volume Map records)

Group capture rows by `event_name` (skip rows where `is_dynamic == true` or `event_name == null`; those go to the dynamic-captures appendix). For each distinct event, compute:

- `event` – the literal name.
- `volume_30d` – pulled from any one row (rows for the same event share volume).
- `last_seen` – same.
- `status` – `resolved` | `phantom` | `pending` (from step 4).
- `capture_sites[]` – list of `{ file, line, package, area, route, enclosing }` for every row sharing this name.
- `areas[]` – distinct `area` values across the sites, alphabetical.
- `packages[]` – distinct non-null `package` values across the sites, alphabetical. Empty if all rows have `package: null`.
- `properties_seen[]` – union of all `properties[]` across the rows, sorted alphabetically.
- `has_conditional` – `true` if any contributing row has `conditional_fire == true`.

Sort by `volume_30d` desc; phantoms sink to the bottom. Compute `total_volume_30d = sum(volume_30d)` across all distinct events; per-event `share = volume_30d / total_volume_30d` for the Volume Map bars.

### c. Group by area (Area Topology records)

First, count the distinct non-null `package` values across all rows. Branch:

- **Multi-package monorepo (≥2 distinct non-null packages):** group two levels deep — `package > area`. For each distinct `package` (plus a `(unscoped)` bucket if any rows have `package: null`), tally per-area records inside it.
- **Single package or flat repo (0 or 1 distinct non-null package):** group flat by `area` as before.

For each `area` record (single-level or nested under a package), taking the first listed `(package, area)` per event when an event spans multiple — events appear once in topology, in their primary location — compute:

- `package` – the package bucket (only used in multi-package mode; `null` otherwise).
- `area` – the bucket name.
- `event_count` – number of distinct events in this area.
- `total_volume_30d` – sum of `volume_30d` for this area's events.
- `events[]` – the area's events, sorted by `volume_30d` desc, each carrying `event`, `volume_30d`, `has_conditional`, `is_phantom`.

Sort areas by `total_volume_30d` desc within their group; in multi-package mode, sort packages by their summed `total_volume_30d` desc.

If every event collapses to one or two `area` buckets (a flat repo), note this inline in the rendered topology section — the by-event table becomes the primary view.

### d. Compute Overview KPIs and panels

Overview is the action-oriented top section. It's a small KPI grid plus a series of issue panels.

#### KPIs (four numbers)

- **Total events (30d)** — `total_volume_30d` from (b).
- **Distinct events** — count of by-event records from (b).
- **Phantom (dead code)** — count of by-event records where `status == "phantom"`.
- **Top 10 = % of volume** — sum of the top ten events' `volume_30d` / `total_volume_30d`, rendered as a percentage. This is the concentration headline; high values (>95%) mean the long tail is mostly low-signal and a handful of events dominate ingestion.

#### Panels (zero or more, render only those that have content)

Each panel is a short bulleted list. Panels are derived deterministically from the inventory.

1. **Volume concentration.** A short text line plus the top 10 events as a bulleted list with bars. Each bullet: `event_name — Xk · share% · ▓▓▓▓░░░░░░`. Bars use Unicode block characters (`▓` for filled, `░` for empty), 12 chars wide, scaled to per-event share of `total_volume_30d`.
2. **Phantom events — in code, zero volume.** Events where `status == "phantom"`. Each bullet: `event_name — area`. Sort by area, then event name.
3. **No properties attached.** Events where `properties_seen[] == []`. Sort by `volume_30d` desc. Each bullet: `event_name — Xk events flying blind`. Limit to top 12; add `… (+N more)` if longer.
4. **Name drift — same concept, different keys.** Pairs of events whose names collapse to the same string when lowercased and stripped of underscores/spaces. Each bullet: `event_a vs event_b — splits funnels on <conceptual key>`.
5. **Type drift — numeric property with mixed types.** Property keys named `revenue`, `amount`, `price`, `count`, `duration_*`, `quantity` whose values mix number and string across call sites. Each bullet: `property — number at file:line, string at file:line — silently zeros aggregates`.
6. **Conditional fires — undercount risk.** Events where `has_conditional == true`. Each bullet: `event_name — fires inside <condition snippet> at file:line`. Sort by volume desc; cap at 8.
7. **Duplicate captures — same event from multiple SDK families.** Events present in both client- and server-side SDK rows, where neither row is in a test file and neither explicitly threads `distinctId` from request context. Each bullet: `event_name — fires from <SDK A> at file:line and <SDK B> at file:line — risks 2× counting`.
8. **Unresolved dynamic captures.** Inventory rows still flagged `is_dynamic: true` after step 3. Each bullet: `file:line — event name is <reason: function arg / template literal / network value>`.
9. **Wrapper likely undiscovered.** Render only when `wrapper_likely: true`. Shape:
   ```markdown
   ### Wrapper likely undiscovered
   Most resolved events are PostHog-reserved infrastructure (`$log`, `$exception`, etc.) and no typed wrapper was found. Product analytics likely route through a helper this audit didn't reach.

   - Grep for `(captureEvent|track|trackEvent|logEvent|analytics\.track)\s*\(` to find candidate wrappers, then re-run the audit.
   ```

Skip any panel whose source list is empty (or whose conditional doesn't hold). Don't render an empty "No phantom events" header — silence is the signal.

These panels carry the findings that previously lived in the standalone Coverage Map and Data Quality sections; rendering them as Overview panels keeps action items in one place at the top of the report.

The coverage-map and data-quality findings live in the report only — they don't get their own ledger rows. The ledger tracks pipeline progress; the report carries the analysis.

### e. Analyze identity & segmentation (shared check)

Reframe identity rules as product-facing capabilities. Identification works differently on the client and the server, so judge per SDK family detected in step 1.

#### Capabilities

1. **Cross-session tracking.**
   - **Client-side family present** (posthog-js, react-native, ios, android, flutter): pass if a `call_kind == "identify"` row exists with a stable user id as first arg (`session.user.id`, `auth.uid()`, JWT `sub`, or similar named variable — not a session-only id, not anonymous), and that identify row precedes the first `capture` row in the same file or auth boundary.
   - **Server-side family present** (posthog-node, python, ruby, go, php, dotnet, elixir): pass if **most** capture rows for that SDK have `distinct_id_kind == "variable"`. Server-side identification is per-call by design; an `identify()` row is **not** required. Fail if the dominant pattern is `"missing"` or `"literal"`.
   - **Both families present:** both branches must pass independently. If client identifies but server fires personless captures (or vice versa), users will appear as two distinct profiles — call this out.

2. **Plan-level breakdown.** Passes if any `set` / `set_once` row sets a `plan` (or `tier`, `subscription_tier`) person property; or `plan` appears in ≥1 capture row's `properties[]`.

3. **Org / team / workspace breakdown.** Passes if any `group` row exists with type `organization`, `team`, `workspace`, or similar.

4. **Cross-device tracking.** Passes if any `reset` row exists. Server-only projects skip this — the concept doesn't apply.

#### Rendering shape (Identity & Segmentation section)

Render as **bold lead** + one bold-leading bullet per capability + sub-bullets for granular evidence. **No prose paragraphs.** Every capability gets its own bullet — consistent shape across audits is what makes the section scannable.

```markdown
**<one-sentence dominant finding stated as product cost or affirmative outcome>**

- **Cross-session (client)** — <pass | partial | blocked>. <one-line evidence with file:line>.
  - <optional sub-bullet for non-obvious downstream impact>
- **Cross-session (server)** — <pass | blocked>. <one-line evidence>.
- **Plan / tier breakdown** — <pass | blocked>. <one-line evidence>.
- **Org / workspace breakdown** — <pass | blocked>. <one-line evidence>.
- **Cross-device hygiene** — <pass | missing | n/a>. <one-line evidence>.
```

If a capability doesn't apply, still emit the bullet with `n/a — <reason>`. Don't omit it.

The qualitative analysis from (d) and (e) is rendered into the report only — it doesn't go through the ledger. The ledger is the pipeline progress tracker; the report is the deliverable.

### f. Render the report incrementally

The markdown report template lives in `references/5-report-template.md`. Compose the report **incrementally** — `Write` the template verbatim, then `Edit` each `{{placeholder}}` with its computed value in a separate turn. **Do not compose the substituted report in one turn.** A single sustained generation of the full document (overview panels, volume map, area topology, identity & segmentation, appendices) routinely drops the LLM streaming connection around the 10-minute mark; chunking via Write + Edit keeps every turn short and resets the SSE timer at each tool call. The on-disk file is the source of truth, so a dropped turn loses at most one placeholder's substitution, not the whole report.

#### Step f.1 — Write the template verbatim

`Read` `references/5-report-template.md`. Then `Write` `posthog-events-audit-report.md` with the template contents unchanged — every `{{placeholder}}` is preserved as a literal string. This is a small Write (the template itself is bounded in size; no per-event content).

#### Step f.2 — Substitute each placeholder with one `Edit`

For each placeholder listed under "Substitution conventions" below, run one `Edit` against `posthog-events-audit-report.md`:

- `old_string`: the literal placeholder (e.g. `{{volume_map_rows}}`)
- `new_string`: the computed substitution value

The order doesn't matter, but a natural sequence is top-of-report → bottom-of-report so the spinner reads cleanly: `{{repo_name}}`, `{{timestamp}}`, `{{mcp_disclaimer}}`, the four KPIs, `{{overview_panels}}`, `{{volume_map_rows}}`, `{{volume_map_footnote}}`, `{{capture_sites_list}}`, `{{area_topology_list}}`, `{{area_topology_commentary}}`, `{{identity_segmentation_details}}`, `{{appendices_list}}`.

#### Step f.3 — Verify before continuing

After all Edits, do a quick `Grep` for `{{` in the file. If any unsubstituted placeholders remain (other than `{{dashboard_callout}}` — see below), the report isn't ready; identify which one and run a follow-up Edit. The wizard surfaces the report to the user via the path emitted in step (g) — shipping a placeholder is visible.

**Exception: `{{dashboard_callout}}` is intentionally not substituted in this step.** Step 6 fills that placeholder after dashboard creation runs. Leave it as-is in the rendered output — step 6 always resolves it (to a link on success, or empty string on failure), so it never ships to the reader.

#### Substitution conventions

These rules tell you how to format each placeholder. The placeholder names themselves are documented in the template's header comment.

- **`{{repo_name}}`** — the project root directory name.
- **`{{timestamp}}`** — short human-readable date (e.g. `2026-05-09`) or full ISO timestamp.
- **`{{mcp_disclaimer}}`** — empty string when `mcp_available: true`. When `mcp_available: false`, a one-paragraph callout. Use this exact shape, substituting `<reason>` from `mcp_skipped_reason`:
  ```markdown
  > **Volume data not fetched.** PostHog could not be queried during this run (<reason>). The events your code captures, where they fire, and how they're identified are still in the report below — but per-event 30-day volume, phantom detection (events seen in code but not in PostHog), and the top-events table are missing. Re-run the audit with PostHog MCP configured to populate them.
  ```
- **`{{total_volume}}`** — formatted with thousands separator (`310,000`) or compact (`310k`); use compact for totals ≥10,000. **Render `—` when `mcp_available: false`.**
- **`{{distinct_count}}`** — integer; from the by-event records in (b). Always renders (code-derived).
- **`{{phantom_count}}`** — integer; render as `0` if no phantoms (the row is still useful at all-zeros). **Render `—` when `mcp_available: false`.**
- **`{{top_10_share}}`** — percentage rounded to nearest whole, e.g. `90%`. **Render `—` when `mcp_available: false`.**
- **`{{overview_panels}}`** — one nested `bulletList`. Each top-level item is one panel: a bold lead with the panel name + the panel's intro framing inline (separated by ` — `), then its rows as sub-bullets:
  ```markdown
  - **<panel title>** — <one-sentence framing>
    - <bullet 1>
    - <bullet 2>
  - **<next panel title>** — <one-sentence framing>
    - …
  ```
  Skip panels with no content. If every panel is empty, render the line `_No issues detected. Naming, types, and capture sites all look consistent._` instead. **No `###` headings — they're flattened into bold leads so the notebook representation can be a single `bulletList` node.**
- **`{{volume_map_rows}}`** — top 10–15 events from (b), one markdown table row each: `| # | \`event_name\` | volume | share | bar |`. Bar column uses a 12-char Unicode block: `▓` × `round(share × 12)`, padded with `░`. Phantom events sink to the bottom of the table; tag them inline with `· phantom` after the event name in the Event column.
- **`{{volume_map_footnote}}`** — one line stating how many events are in the table vs. total, plus a pointer to where the long tail can be found. Example: `Showing top 12 of 51 distinct events; the remaining events appear in the Area topology section below.`
- **`{{capture_sites_list}}`** — **one nested `bulletList`**. Each top-level item is one event from the Volume Map: a bold lead with `` `event_name` — N events / M sites ``, then sub-bullets for each capture site, and a final sub-bullet for properties. Include `package <name>` in each site bullet only when the event's `packages[]` is non-empty. When `via_wrapper` is non-null on a site, append `· via \`<wrapper>\`` to that bullet. No HTML — plain markdown only:
  ```markdown
  - **`purchase_completed` — 1,400 events / 3 sites**
    - `apps/web/components/Checkout/Checkout.tsx:88` — package `web`, area `checkout`, route `/checkout`, enclosing `handleSubmit` · via `captureEvent`
    - `apps/mobile/Checkout.tsx:44` — package `mobile`, area `checkout`, enclosing `onPaymentSuccess` · via `track`
    - `apps/web/api/orders.ts:55` — package `web`, area `api`, enclosing `completeOrder`
    - _Properties: `revenue`, `currency`, `plan`_
  - **`switched site mode` — 20,373 events / 6 sites**
    - …
    - _Properties: none_
  ```
  Properties line is `_Properties: <comma-separated>_` for non-empty `properties_seen[]`, or `_Properties: none_` when empty. **No `####` headings, no horizontal rules between events** — they're flattened into bold leads so the notebook representation can be a single `bulletList` node.
- **`{{area_topology_list}}`** — **one nested `bulletList`** of areas (or packages in multi-package mode). In single-package mode, each top-level item is one area:
  ```markdown
  - **<area> — <total_volume> · <event_count> events**
    - `event_a` — Xk · conditional
    - `event_b` — Yk
    - `event_c` — Zk · phantom
  ```
  In multi-package mode, nest two levels deep — each top-level item is a package, sub-list items are areas, leaf items are events:
  ```markdown
  - **<package> — <package_total_volume> · <area_count> areas**
    - **<area> — <total_volume> · <event_count> events**
      - `event_a` — Xk
    - **<area> — <total_volume> · <event_count> events**
      - `event_b` — Yk
  - **<next package> — …**
    - …
  ```
  Use `(unscoped)` for rows with `package: null`. Annotations after the volume: `· conditional` if the event has `has_conditional`, `· phantom` if `is_phantom`. Both can stack. **No `###` or `####` per-area headings** — they're flattened into bold leads.
- **`{{area_topology_commentary}}`** — one or two short bullets if the topology has notable shapes (e.g. "Auth events all live in `shared` — without a `source` property, you can't tell which page surface triggered each login"). Skip when nothing notable applies.
- **`{{identity_segmentation_details}}`** — the bold-lead-plus-bullets shape from step (e).
- **`{{appendices_list}}`** — **one nested `bulletList`** of appendices. Each top-level item is one appendix: a bold lead with the appendix name + one-sentence framing, then sub-bullets for each entry. Skip appendices whose content list would be empty (don't render a `**Name** — _None._` placeholder; just leave the appendix out). If every appendix is empty, render the line `_No appendix content for this audit._` instead.
  ```markdown
  - **Dynamic event names** — Events whose name couldn't be resolved at scan time (template literal, network value, or imported enum). Listed for completeness; not in §2's table.
    - `file:line — <reason>`
    - …
  - **Person properties (`identify` / `set` / `set_once`)** — Distinct person-property keys the code sets, deduplicated.
    - `key_a`
    - `key_b`
    - …
  - **Groups (`group`)** — Group types and keys passed to `posthog.group()`.
    - `<group_type>: <group_key>`
    - …
  - **Exception capture sites** — Locations calling `posthog.captureException()`.
    - `file:line — captureException(<short snippet>)`
    - …
  ```
  **Replaces the four separate `## Appendix – …` sections** the template used to have. Everything lives under one `## Appendices` heading with this single nested list.

#### Rendering rules

- **Don't pre-stream content into assistant text.** Compute substitution values in memory, then emit them as `Edit` `new_string` arguments. Recapping each section in assistant text before the Edit doubles the output-token cost.
- **Plain language, no grades.** Don't render the check `status` enum (`pass`/`warning`/`error`) as a badge or label in the report. Use prominence and word choice — a missing flagship capability leads its section; a nice-to-have is a footnote bullet.
- **`file:line` citations** on every non-pass observation.
- **Fan-out is not used in this step.** One Edit per placeholder, sequentially.

### g. Surface the deliverable and resolve the phase

**Only one file is produced by this skill:** `posthog-events-audit-report.md`. **Do not write any additional summary, recap, or "what was done" file** (e.g. `posthog-audit-report.md`, `audit-summary.md`, `SUMMARY.md`). The single report from step (f) is the entire deliverable. Don't write an end-of-turn summary as a file — keep that in the chat reply only.

After the report is written, flip the `write-report` row to `pass`:

```json
{
  "updates": [
    { "id": "write-report", "status": "pass" }
  ]
}
```

**Do not delete `.posthog-audit-checks.json` or `.posthog-events-inventory.json` yet** — step 6 needs the inventory for the IN-list and resolves the final `create-dashboard` row in the same ledger. Step 6 cleans both files up at the end.

Emit one trailing line so the wizard can surface the report to the user:

```
Created events audit report: <absolute path to posthog-events-audit-report.md>
```

## Resolve

`next_step: 6-dashboard.md`. Step 6 handles the optional dashboard creation, resolves the final phase row, and cleans up the transient files.
