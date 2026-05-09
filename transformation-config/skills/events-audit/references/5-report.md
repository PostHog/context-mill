---
next_step: null
---

# Step 5 – Render the report

Produce the audit deliverable in a single pass: a by-event inventory table sorted by 30-day volume, a short by-area index that doubles as a lightweight flow map, three shared qualitative checks (identity & segmentation, coverage map, data quality), and a suggested follow-ups list the PM can paste back to ask Claude.

The skill's job ends with a map and a few short observations. **Don't cluster events into flows. Don't write per-flow narratives. Don't synthesize a story.** The PM does that on demand.

## Output discipline

This is one report `Write`, not a write-then-read-then-rewrite cycle. Prior runs read their own freshly-written report 23 seconds after writing it and regenerated it — that wastes ~3 minutes of generation per cycle. Compose the entire Markdown in one model turn, then call `Write` once. If something is wrong with the result, fix it via `Edit` on the same file — don't `Write` it again.

Also: don't recap the inventory contents in assistant text before writing. Stream straight from the inventory you already read into the report.

## Status

Emit, in order:

```
[STATUS] Reading inventory
[STATUS] Computing area index
[STATUS] Analyzing identity & segmentation
[STATUS] Analyzing coverage map
[STATUS] Analyzing data quality
[STATUS] Writing report
```

## Action

### a. Read the inventory

`Read` `.posthog-events-inventory.json` once. From it you'll work with:

- `rows[]` – capture rows (sorted by `volume_30d` desc by step 4) with `event_name`, `properties[]`, `area`, `route`, `enclosing`, `volume_30d`, `last_seen`, `status`, etc.
- `actions[]` – optional, for the appendix.
- `wrapper_undetected` – top-level boolean.

If `rows[]` is empty, render a short report explaining the inventory is empty, resolve all three shared checks with `pending` details (no data to evaluate), and exit.

### b. Aggregate by event name (the headline view)

Group capture rows by `event_name` (skip rows where `is_dynamic == true` or `event_name == null`; those go to the dynamic-captures footnote). For each distinct event, compute:

- `event` – the literal name.
- `volume_30d` – pulled from any one row (all rows for the same event share volume).
- `last_seen` – same.
- `status` – `resolved` | `phantom` | `pending` (one of the three step 4 set).
- `capture_sites[]` – list of `{ file, line, area, route, enclosing }` for every row sharing this event name.
- `properties_seen[]` – union of all `properties[]` across the rows, sorted alphabetically.

Sort by `volume_30d` desc; phantoms sink to the bottom of the table; ties break by event name.

### c. Compute the by-area index

Tally distinct event names per `area`. Build `[{ area, event_count, total_volume_30d }]`, sorted by `total_volume_30d` desc. Use this as the report's "flow map" — a one-line summary at the top of §1 plus a short index. **Don't render per-area narratives.** The index points the PM at where to look; the by-event table is where they read.

If every row collapses to one or two `area` buckets (a flat repo without per-feature directories), say so in plain language ("Capture sites all live in a few shared modules — the area grouping is coarse here") and let the PM scan the by-event table directly.

### d. Analyze identity & segmentation (shared check)

Reframe identity rules as PM-facing capabilities. Identification works differently on the client and the server, so judge per SDK family detected in step 1.

#### Capabilities

1. **Cross-session tracking.**
   - **Client-side family present** (posthog-js, react-native, ios, android, flutter): pass if a `call_kind == "identify"` row exists with a stable user id as first arg (`session.user.id`, `auth.uid()`, JWT `sub`, or similar named variable — not a session-only id, not anonymous), and that identify row precedes the first `capture` row in the same file or auth boundary.
   - **Server-side family present** (posthog-node, python, ruby, go, php, dotnet, elixir): pass if **most** capture rows for that SDK have `distinct_id_kind == "variable"`. Server-side identification is per-call by design; an `identify()` row is **not** required. Fail if the dominant pattern is `"missing"` or `"literal"`.
   - **Both families present:** both branches must pass independently. If client identifies but server fires personless captures (or vice versa), users will appear as two distinct profiles — call this out.

2. **Plan-level breakdown.** Passes if any `set` / `set_once` row sets a `plan` (or `tier`, `subscription_tier`) person property; or `plan` appears in ≥1 capture row's `properties[]`.

3. **Org / team / workspace breakdown.** Passes if any `group` row exists with type `organization`, `team`, `workspace`, or similar.

4. **Cross-device tracking.** Passes if any `reset` row exists. Server-only projects skip this — the concept doesn't apply.

#### Rendering shape (§3 in the report)

Render as **bold lead** + one bold-leading bullet per capability + sub-bullets for granular evidence. **No prose paragraphs.** Every capability gets its own bullet — consistent shape across audits is what makes the section scannable.

```markdown
**<one-sentence dominant finding stated as PM cost or affirmative outcome>**

- **Cross-session (client)** — <pass | partial | blocked>. <one-line evidence with file:line>.
  - <optional sub-bullet for non-obvious downstream impact>
- **Cross-session (server)** — <pass | blocked>. <one-line evidence>.
- **Plan / tier breakdown** — <pass | blocked>. <one-line evidence>.
- **Org / workspace breakdown** — <pass | blocked>. <one-line evidence>.
- **Cross-device hygiene** — <pass | missing | n/a>. <one-line evidence>.
```

If a capability doesn't apply (e.g. server-only project for cross-device), still emit the bullet with `n/a — <reason>`. Don't omit it.

#### Resolve the check

Call `mcp__wizard-tools__audit_resolve_checks` for `identity-segmentation` with status `pass` if all applicable capabilities pass, `warning` if cross-session is partial or one segmentation breakdown is blocked, `error` if cross-session fails. `details` mirrors the rendering shape above. No grades.

### e. Analyze coverage map (shared check)

Walk the by-area index from (c). Coverage is qualitative — describe state, don't grade.

#### Things to call out

- **Distribution** — how many areas carry events; what kinds of activity they cover (engagement, conversion, content, server-side, etc.). One bullet, factual.
- **Dark surfaces** — areas where captures exist in code but have zero 30-day volume. Name the area and a representative file. Each dark surface gets its own bullet.
- **Reliance on `shared` / `global`** — if these areas carry a large share of captures, flag it: the coverage map can't tell you which user-visible surface fired the event without a follow-up.
- **Person properties without events** — `setPersonProperties` calls in areas that have no `capture` events. Person properties without events mean you can describe the user but can't count their actions.
- **Wrapper-undetected** — if `wrapper_undetected == true` from step 2: "An SDK is installed but no direct capture sites were found. There's likely a wrapper the scanner didn't follow."
- **Coarse grouping** — if only one or two `area` buckets exist: "The repo isn't organized by feature; the by-event table is the primary view."

#### Rendering shape (§4 in the report)

Render as **bold lead** + one bold-leading bullet per observation + sub-bullets for evidence. **No prose paragraphs.** Use the bullet labels above (`Distribution`, `Dark surface — <name>`, `Reliance on shared/global`, etc.) so multiple audits stay comparable.

```markdown
**<one-sentence summary: where coverage is broad, where it's dark>**

- **Distribution** — <N> distinct areas carry events: <short list of area kinds>.
- **Dark surface — <area name>** — <N> events implemented at `<file:line>` and `<file:line>` have zero 30-day volume. <one-line consequence>.
- **Reliance on `shared`** — <event names> all fire from `<file:line>`. Without a `source` property, you can't tell which page surface triggered them.
- **<area> sets person properties but emits no events** — `<file:line>`. You see who but not what they did.
```

Skip bullets that don't apply. Don't render an empty "Wrapper-undetected: n/a" bullet.

#### Resolve the check

Call `audit_resolve_checks` for `coverage-map` with status `pass` (broad coverage, multiple areas, no dark surfaces), `warning` (one or more dark surfaces, or heavy reliance on `shared`), or `suggestion` (wrapper-undetected or coarse grouping). `details` mirrors the rendering shape above.

### f. Analyze data quality (shared check)

Walk the inventory once. Only flag issues that bite a PM building dashboards.

1. **Name drift** — same concept under two different keys. Heuristic: lowercase + strip underscores; if two keys collapse to the same string, that's drift. Examples: `user_id` vs `userId`, `signup_method` vs `method`. **Splits funnels.**
2. **Type drift on numeric properties** — for keys named `revenue`, `amount`, `price`, `count`, `duration_*`, `quantity`, scan call-site literals; mixing number and string is an error. **Silently zeros out aggregates.**
3. **Conditional-fire undercount** — count rows with `conditional_fire: true` and list affected events. **Funnel undercounts on certain code paths.**
4. **Duplicate-event overcount** — same event name on two SDK families. Skip when one is in test files or one explicitly threads `distinctId` from request context.
5. **Phantom events** — `status == "phantom"` rows. List the top offenders. **Either typo, dead code path, or instrumentation that hasn't shipped.**
6. **Unresolved dynamic names** — rows where step 3 left `is_dynamic: true`. Flag as undercount risk.

#### Rendering shape (§5 in the report)

Render as **bold lead** stating the worst issue as a PM cost + one bold-leading bullet per issue + sub-bullets for granular evidence (call sites, property unions, paired events). **No prose paragraphs.**

```markdown
**<lead finding stated as a PM cost — e.g. "`revenue` type drift will silently zero out checkout aggregates.">**

- **<Issue label — Name drift / Type drift / Conditional fire / Duplicate captures / Phantom events / Unresolved dynamics>** — <one-line evidence with file:line>.
  - <sub-bullet: representative offender or property union>
  - <sub-bullet: paired-event break or volume anomaly>
- **<Next issue>** — <one-line evidence>.
```

Sort issues by PM cost: type drift > name drift on flagship events > duplicate captures > conditional fires > phantom clusters > unresolved dynamics. The lead bold sentence names whichever issue tops that list.

#### Resolve the check

Call `audit_resolve_checks` for `data-quality` with status `pass` (no issues), `warning` (one or two issues), or `error` (type drift, name drift on flagship events, or many phantoms). `details` mirrors the rendering shape above.

### g. Render the report

`Write` `posthog-events-audit-report.md` at the project root. Single Markdown file, composed in one model turn. Strip the `BEGIN-REPORT` / `END-REPORT` markers when writing.

```markdown
<!-- BEGIN-REPORT -->
# PostHog events audit – {{repo_name}}

_Generated {{timestamp}}_

This audit lists every event your code captures, where it fires, and how often PostHog has seen it in the last 30 days. The deliverable is the inventory plus three short observations — use the suggested follow-ups at the end to ask Claude focused questions against the inventory.

## 1. Events by volume

{{one-line summary: "<N> distinct events captured across <M> areas; top areas: <area1, area2, area3>."}}

| Event | Volume (30d) | Sites | Areas | Properties |
|-------|--------------|-------|-------|------------|
{{event_rows}}

Notes column conventions:
- `(phantom)` after the event name when `status == "phantom"`.
- `(conditional)` when any site has `conditional_fire == true`.
- Sites column: count of distinct `file:line` (e.g. `3 sites`).
- Areas column: comma-separated unique `area` values for this event (`checkout`, `Posts`).
- Properties column: comma-separated keys, truncated to ~5 with `… (+N more)` if longer.

### Capture sites per event

For each event in the table above, render a collapsible-style block:

```markdown
<details>
<summary><code>purchase_completed</code> — 1,400 events / 3 sites</summary>

- `src/checkout/Checkout.tsx:88` — area `checkout`, route `/checkout`, enclosing `handleSubmit`
- `mobile/Checkout.tsx:44` — area `checkout`, enclosing `onPaymentSuccess`
- `api/webhooks/stripe.py:120` — area `api/webhooks`, enclosing `handle_payment_intent`

Properties seen: `revenue`, `currency`, `plan`
</details>
```

Use HTML `<details>` so the report stays scannable but every site is one click away.

## 2. By area

A coarse map of where instrumentation lives.

| Area | Events | 30d volume |
|------|--------|------------|
{{area_index_rows}}

{{one-line note from step (c): coarse-grouping or normal}}

## 3. Identity & segmentation

{{identity_segmentation_details}}

## 4. Coverage map

{{coverage_map_details}}

## 5. Data quality

{{data_quality_details}}

## Suggested follow-ups

You can ask Claude any of these against the inventory at `.posthog-events-inventory.json`:

- Which of these events fire on `<flow you care about>`? (e.g. signup, checkout, onboarding)
- Which events have inconsistent property naming or types?
- Build a funnel from `<event A>` to `<event B>` and tell me the drop-off.
- Which areas have the highest event volume but the thinnest property coverage?
- Which phantom events look like dead instrumentation we can remove?

## Appendix – dynamic event names

Events whose name couldn't be resolved at scan time (template literal, network value, or imported enum). Listed for completeness; not in §1's table.

{{dynamic_appendix}}

## Appendix – person properties (`identify` / `set` / `set_once`)

{{person_properties_appendix}}

## Appendix – groups (`group`)

{{groups_appendix}}

## Appendix – actions

{{actions_appendix}}

## About this audit

Generated by the PostHog events-audit skill. The full inventory is at `.posthog-events-inventory.json` (kept after the run for follow-up questions). Re-run `posthog-wizard events-audit` to refresh.
<!-- END-REPORT -->
```

### Rendering rules

- **One `Write` call.** Compose the full Markdown in your turn before invoking `Write`. Don't pre-stream the content into assistant text.
- **Plain language, no grades.** Don't render the check `status` enum (`pass`/`warning`/`error`) as a badge or label in the report. Use prominence and word choice — a missing flagship capability leads its section; a nice-to-have is a footnote bullet.
- **`file:line` citations** on every non-pass observation.
- **Fan-out is not used in this step.** The data fits in one turn.

### h. Surface the deliverables

The inventory is the deliverable. **Do not delete `.posthog-events-inventory.json`.**

Emit two trailing lines so the wizard can surface both files to the user:

```
Created events audit report: <absolute path to posthog-events-audit-report.md>
Kept events inventory: <absolute path to .posthog-events-inventory.json>
```

## Resolve

`next_step: null` – the chain ends here. By the end of this step, all three shared checks (`identity-segmentation`, `coverage-map`, `data-quality`) must be resolved via `audit_resolve_checks`. There are no per-flow checks to resolve.
