---
next_step: 4-plan.md
---

# Step 3: Turn detections into a prioritized proposal

The detection result is at `/tmp/posthog-cross-sell-opportunities.json` (Step 1); the toolchain is at `/tmp/posthog-cross-sell-env.json` (Step 2). This step drops healthy products, scores the rest for fit/value/effort, decides which are scaffoldable today, and writes `/tmp/posthog-cross-sell-plan.json`. It does NOT write per-item implementation plans (Step 4 owns the `plan` block) and does NOT edit source.

## Status

Emit:

```
[STATUS] Prioritizing opportunities
[STATUS] Writing the proposal
```

## Action

### a. Drop non-opportunities

Read the opportunities file. Discard every product whose `mode` is `in-use` (already adopted and healthy — nothing to sell). Keep `cross-sell`, `greenfield`, and `gap`.

### b. Score each kept product

For each, decide:

- `fit` — `high` when the evidence is strong and concrete (a competitor in active use, or a clear uninstrumented surface); `medium` when evidence is partial; `low` when the signal is weak or speculative.
- `value` — one or two sentences naming the specific upside for *this* project, referencing what the evidence shows (e.g. "Three catch blocks in the API routes swallow errors silently — Error Tracking would surface them with stack traces and session context"). Tie cross-sell modes to the consolidation win ("replace Sentry, unify with the analytics you already send").
- `effort` — `S` (a few call-sites, SDK already present), `M` (new init/provider wiring or a new PostHog package), `L` (spans many surfaces or needs product/config decisions).

### c. Classify scaffold vs propose-only

- `scaffold` — the integration is code-driven, the only new dependency (if any) is an official PostHog package, and Step 1 found a concrete surface to wire it into. Typical: Feature Flags (gate a real existing toggle), Error Tracking (wire `captureException` into existing catch blocks), Product Analytics / Web Analytics gaps (add captures on a named surface), LLM Observability (wrap an existing AI client), Session Replay (enable in init).
- `propose-only` — needs a decision or setup code can't safely make on its own: a product configured outside code (Surveys are built in the PostHog UI), a new backend/infra choice (Logs sink selection), or a greenfield product with no concrete surface in the repo yet. Record a one-line `skip_reason`.

Anything with `fit: low` is `propose-only` regardless, unless the fix is a trivial one-line init change.

### d. Write the plan

`Write` `/tmp/posthog-cross-sell-plan.json`, items ordered by `fit` (high→low) then `effort` (S→L):

```json
{
  "project_root": "<from opportunities file>",
  "items": [
    {
      "id": "feature-flags", "product": "Feature Flags",
      "mode": "greenfield", "competitor": null,
      "fit": "high", "value": "...", "effort": "S",
      "evidence": ["app/rate/page.tsx:31"],
      "classification": "scaffold", "skip_reason": null,
      "plan": null,
      "status": "scaffold" ? "proposed" : "propose-only",
      "notes": null
    }
  ]
}
```

Set `status` to `proposed` for `scaffold` items and `propose-only` for the rest.

## Output

The plan file exists; its item count equals the kept-product count (everything except `in-use`). Finish by emitting:

```
[STATUS] Proposal ready: <N> to scaffold, <M> proposal-only
```
