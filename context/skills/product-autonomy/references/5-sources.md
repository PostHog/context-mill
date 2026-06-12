---
next_step: 6-connected-tools.md
---

# Step 5 — Enable native signal sources

Switch on the PostHog-native sources (the inbox's "Responders") that match what this product actually uses, per your step-2 checklist. Conditional means conditional: a source for a surface the product doesn't have just adds noise.

## Status

Emit:

```
[STATUS] Enabling signal sources
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__inbox-source-configs-create,mcp__posthog-wizard__inbox-source-configs-partial-update,mcp__posthog-wizard__inbox-source-configs-list`.

## The write recipe (use for every source here and in step 6)

1. Check the baseline list (from step 1; refresh with `inbox-source-configs-list` if you're unsure it's current).
2. Row exists and `enabled: true` → leave it alone, record "already enabled".
3. Row exists and `enabled: false` → `inbox-source-configs-partial-update` with `{ enabled: true }`.
4. No row → `inbox-source-configs-create` with `{ source_product, source_type, enabled: true }`. A 400 about uniqueness means a row appeared since you listed — fall back to 3.
5. Any other failure → record it as a follow-up and move on; a single failed source never stops the run.

## Enable

| Source | When | Payload |
|---|---|---|
| Scout gate | **Always** — it lets the step-7 fleet's findings reach the inbox | `signals_scout` / `cross_source_issue` |
| Error tracking | Error tracking is in use anywhere: instrumented in this repo (report), exception autocapture ON (project-state block), or error issues exist (step-2 probe) | **All three rows**: `error_tracking` / `issue_created`, `error_tracking` / `issue_reopened`, `error_tracking` / `issue_spiking` — the product UI treats them as one switch |
| Session replay | Replay is enabled for the **project**: recording opt-in ON (project-state block) OR recordings exist (step-2 probe) OR the report says this repo instruments it — **and** step 3 recorded approval. Opt-in ON with zero recordings still counts (recordings just haven't arrived yet). Skip only when all three say no/unknown, with reason "replay not enabled for this project" | `session_replay` / `session_analysis_cluster` — don't pass a `config`; the server injects the default sample rate. A 400 mentioning AI approval → apply step 3's reality check (skip + follow-up) |
| Support | The team uses PostHog support/conversations (per the profile) | `conversations` / `ticket` |

## Skip — do not create

- `llm_analytics` (internal-only, not a user-facing responder)
- `logs` (not a v1 responder)
- Anything with `source_type` `evaluation` or `alert_state_change`
- The connected-tool sources (`github`, `linear`, `zendesk`, `pganalyze`) — those are step 6, ask-first.

Record every enable/skip decision with its reason — the report needs them.
