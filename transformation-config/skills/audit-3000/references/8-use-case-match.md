---
next_step: 9-use-case-expansion.md
---

# Step 8 — Use case match

Optional, derives recommendations from the enrichment data gathered in Step 7. Maps the customer's company + person signals to one of PostHog's six [use cases](https://posthog.com/handbook/growth/use-case-selling/use-case-selling) so the TAM running the audit knows which playbook to lead with.

If Step 7 was skipped or returned nothing, this step also skips silently and continues to Step 9. This step never aborts the chain.

## Status

Emit:

```
[STATUS] Loading enrichment data
[STATUS] Scoring use cases
[STATUS] Writing use case match
[STATUS] Writing playbook snapshot
```

After every path through this step (match, skip, or low confidence), emit once:

```
Wrote playbook snapshot: /tmp/posthog-use-case-match.json
```

## Action

### a. Load enrichment data

Read the JSON the previous step already saved:

- Company: `/tmp/co.json` (Harmonic response)
- Person: `/tmp/pe.json` (PDL response)

If `/tmp/co.json` doesn't exist or its HTTP status from Step 7 wasn't `200`/`201`, **skip silently** — emit `[STATUS] No enrichment data — skipping use case match`, then **`Write`** `/tmp/posthog-use-case-match.json` as exactly:

```json
{"skipped":true,"reason":"no_enrichment"}
```

Then emit `[STATUS] Writing playbook snapshot` and the `Wrote playbook snapshot:` line, then continue to Step 9. The company response is required; the person response is optional (matching falls back to company-only when PDL returned 404).

**Before constructing your section**, also `Read` the bundled `use-case-match-example.md` reference once (typically `.claude/skills/audit-3000/references/use-case-match-example.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/use-case-match-example.md`). Use it to model section ordering, badge format, "Why this match" bullet density, and the persona/products copy. The example uses fictional company + person data on purpose — copy the *shape* of the output, never any specific value from the example.

### b. Score the six use cases

Compute an integer score for each of the six use cases using the rules below. Sum the signals for each. Use cases:

1. `product-intelligence`
2. `release-engineering`
3. `observability`
4. `growth-and-marketing`
5. `ai-llm-observability`
6. `data-infrastructure`

#### Company signals (always run)

For each rule, if the condition matches, add the listed points to the named use case.

**Team composition** (from `.traction_metrics.headcount_<team>.latest_metric_value` — only count if > 0):

| Team field | Use case | Points |
|---|---|---|
| `headcount_product` | product-intelligence | +2 |
| `headcount_design` | product-intelligence | +1 |
| `headcount_data` | data-infrastructure | +2 |
| `headcount_engineering` with density ≥ 0.40 of total `.headcount` | release-engineering | +2 |
| `headcount_marketing` | growth-and-marketing | +2 |
| `headcount_sales` | growth-and-marketing | +1 |
| `headcount_customer_success` | growth-and-marketing | +1 |

**Tag matches** (case-insensitive on `.tags_v2[].display_value` and `.tags[].display_value`):

| Tag pattern | Use case | Points |
|---|---|---|
| `/analytics\|business intelligence/i` | product-intelligence | +2 |
| `/data analytics\|data warehouse\|data pipeline/i` | data-infrastructure | +2 |
| `/developer operations\|devops\|ci\|cd/i` | release-engineering | +1 |
| `/infrastructure\|reliability\|monitoring\|observability/i` | observability | +2 |
| `/marketing\|growth\|sales\|GTM\|advertising/i` | growth-and-marketing | +1 |
| `/\bAI\b\|\bML\b\|artificial intelligence\|machine learning\|LLM/i` (in TECHNOLOGY_TYPE or MARKET_SUB_VERTICAL) | ai-llm-observability | +3 |
| `/SaaS\|cloud infrastructure/i` | observability | +1 |

**Archetype boost** (from Step 7's Classification):

- Archetype == `AI Native` → ai-llm-observability +2
- Archetype == `Cloud Native` AND has engineering team → release-engineering +1

**Customer type:**

- `.customer_type == "B2C"` → growth-and-marketing +1, product-intelligence +1
- `.customer_type == "B2B"` (most cases) → no adjustment

#### Person signals (only when PDL returned 200)

These weight heavily — a confirmed person title is the strongest single signal.

**PDL `job_title_role`** (normalized role from PDL):

| `job_title_role` | Use case | Points |
|---|---|---|
| `product` or `design` | product-intelligence | +5 |
| `marketing` or `sales` | growth-and-marketing | +5 |
| `data` | data-infrastructure | +5 |
| `research` | ai-llm-observability (if archetype == AI Native) | +3 |
| `research` | product-intelligence (otherwise) | +3 |
| `engineering` | see title text rules below | — |
| `operations` | growth-and-marketing | +2 (operators often run GTM) |

**PDL `job_title` text** (raw title, case-insensitive substring match):

| Title contains | Use case | Points |
|---|---|---|
| `growth`, `CRO`, `GTM` | growth-and-marketing | +5 |
| `AI`, `ML`, `LLM`, `machine learning` | ai-llm-observability | +5 |
| `data engineer`, `analytics engineer`, `data platform` | data-infrastructure | +5 |
| `platform engineer`, `devex`, `developer experience` | release-engineering | +4 |
| `SRE`, `site reliability`, `reliability engineer`, `DevOps engineer` | observability | +5 |
| `product manager`, `head of product`, `founder`, `CEO` | product-intelligence | +4 |
| `engineering manager`, `head of engineering`, `VP engineering` | release-engineering | +4 |
| `infrastructure engineer`, `platform team` | observability | +3 |

**PDL `job_title_levels`** (array — junior, senior, manager, director, cxo):

- Levels include `cxo`, `vp`, `director` → boost the use case from `job_title_role` by +1 (executive personas have bigger purchasing power per use case)

### c. Rank and pick primary + secondary

After scoring, sort use cases by score descending. Apply the rules:

- **Primary** = the highest-scoring use case (require score ≥ 3 to qualify).
- If **no** use case reaches score ≥ 3, do **not** edit `/tmp/posthog-enrichment-staged.md` for a use-case section — emit `[STATUS] No use case match confidence — skipping`, then **`Write`** `/tmp/posthog-use-case-match.json` as exactly:

```json
{"skipped":true,"reason":"low_confidence"}
```

Then emit `[STATUS] Writing playbook snapshot` and the `Wrote playbook snapshot:` line, then continue to Step 9 (skip §d and §e below).
- **Secondary** = up to 2 additional use cases whose score is within 4 points of the primary AND ≥ 3 absolute.
- If the primary's score is much higher than all others (gap of 6+), render only the primary — no secondaries.
- Tie-break: when two use cases tie for primary, the one with higher person-signal weight wins. If person signals are equal, prefer the use case with broader product coverage (Growth & Marketing > Product Intelligence > Release Engineering > Data Infrastructure > AI/LLM Obs > Observability).

### d. Insert the Use case match section into the staged enrichment file

`Read` the **staged file at `/tmp/posthog-enrichment-staged.md`** (NOT a project-root `posthog-enrichment.md` — that file no longer exists; everything is staged in `/tmp/` and Step 10 will inline it into the final audit report). Insert the new section **between the `## Company` section and the `## Person` section** (i.e., immediately before the line `^## Person$`).

Also **update the top-line summary** to include the use case alongside the existing Classification badge. Use `Edit` on `/tmp/posthog-enrichment-staged.md` to change:

```
**Classification:** <Archetype> · <Scale tier>
```

to:

```
**Classification:** <Archetype> · <Scale tier>
**Use case:** <Primary> _(see Use case match below)_
```

## Section template

<use-case-match>
## Use case match

**Primary:** [Use case display name] · [`playbook ↗`](https://posthog.com/handbook/growth/use-case-selling/<slug>)

[If any secondaries exist:]
**Secondary:** [Use case 1] _([slug ↗](https://posthog.com/handbook/growth/use-case-selling/<slug-1>))_, [Use case 2] _([slug ↗](...))_

### Why this match

[Bullet list of the top 3–5 signals that drove the primary match, drawn from the rules above. Each bullet cites the data point in italics. Example:]

- Engineering density 40%+ (109/201 = 54%) — strong engineer-led buyer signal _(release-engineering +2)_
- Tags include "Analytics & Business Intelligence Platforms" _(product-intelligence +2)_
- Tags include "Data Analytics" _(data-infrastructure +2)_
- Person record unavailable from PDL — match relies on company signals only

### Persona to target

[Look up the primary use case's core buyer personas from the handbook table:]

- **product-intelligence** → PMs, designers, product engineers, founders
- **release-engineering** → Engineering managers, platform teams, developers
- **observability** → SREs, platform engineers, DevOps
- **growth-and-marketing** → Growth engineers, marketing leads, CRO, GTM engineers
- **ai-llm-observability** → AI/ML engineers, AI PMs, AI founders
- **data-infrastructure** → Data engineers, analytics engineers, product ops

[If PDL returned a person match, also call out:]
The customer running this audit (<full_name>, <job_title>) <matches | doesn't match> the primary use case's persona profile.

### Recommended PostHog products to lead with

[For the primary use case, list the products from the product coverage matrix in the handbook. Source of truth: https://posthog.com/handbook/growth/use-case-selling/use-case-selling#product-coverage-matrix]

- **product-intelligence** → Product Analytics (primary), Session Replay, Surveys, Experiments
- **release-engineering** → Feature Flags, Experiments, Error Tracking, Session Replay
- **observability** → Error Tracking, Logging, Session Replay
- **growth-and-marketing** → Web Analytics, Marketing Analytics, Revenue Analytics, Workflows, Product Tours, Experiments
- **ai-llm-observability** → LLM Observability, AI Evals, Session Replay, Error Tracking
- **data-infrastructure** → Data Warehouse, Data Pipelines / Batch Exports

</use-case-match>

After the section is inserted, emit:

```
Use case match: <Primary> (secondary: <list or "none">)
```

### e. Playbook snapshot for Step 9 (machine-readable)

Immediately after a **successful** match (you inserted the Use case match section into `/tmp/posthog-enrichment-staged.md`), **`Write`** `/tmp/posthog-use-case-match.json` with this shape (all six slugs must appear under `scores`; `secondaries` is an array, possibly empty):

```json
{
  "skipped": false,
  "primary": { "slug": "<canonical-slug>", "score": <int> },
  "secondaries": [{ "slug": "<canonical-slug>", "score": <int> }],
  "scores": {
    "product-intelligence": <int>,
    "release-engineering": <int>,
    "observability": <int>,
    "growth-and-marketing": <int>,
    "ai-llm-observability": <int>,
    "data-infrastructure": <int>
  }
}
```

Use the **same canonical slugs** as in §b (`product-intelligence`, `release-engineering`, etc.), not display names. Mirror the primary/secondary you rendered in markdown (including the “gap of 6+ → no secondaries” rule).

Emit `[STATUS] Writing playbook snapshot` and the `Wrote playbook snapshot:` line, then proceed to Step 9.

## Key principles

- **Optional**: any missing prerequisite (no enrichment from Step 7, low confidence in all matches) → skip silently and continue to Step 9. Never block the audit.
- **Score floor**: require ≥ 3 points for the primary match. Below that, we have too little to lead a TAM in a specific direction — better to skip than mislead.
- **Person signal beats company signal**: a confirmed PDL title weighs more than aggregated company tag matches, because individual buyer fit is what drives a single deal.
- **Reproducible**: same inputs must produce the same output. No "lean toward X" tiebreakers that depend on Claude's judgment — encode all preferences in the scoring rules.
- **No new API calls**: this step reads only `/tmp/co.json` and `/tmp/pe.json` from Step 7. Don't re-fetch.
- **No new files under the project root**: edit the staged file at `/tmp/posthog-enrichment-staged.md` for human-readable output. Additionally **`Write`** `/tmp/posthog-use-case-match.json` (see §e and the early-skip paths above) so Step 9 can read playbook slugs without parsing markdown — same `/tmp/` contract as `/tmp/co.json`. Step 10 deletes that JSON, `/tmp/co.json`, and `/tmp/pe.json` during cleanup. Never write enrichment or playbook files at the repo root.

## Coverage expectations

- Companies with rich Harmonic tags + a 200 PDL match → confident primary + 1–2 secondaries.
- Companies with rich Harmonic tags but PDL 404 → primary is still reliable (company signals carry it); secondaries may be less defensible.
- Companies with sparse Harmonic data (e.g., 404 or thin tag coverage) → score floor will trip, step skips. That's the right outcome — don't recommend a playbook without evidence.
