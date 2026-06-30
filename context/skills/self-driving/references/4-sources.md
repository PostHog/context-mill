---
next_step: 5-connected-tools.md
---

# Step 4 — Enable native signal sources

Switch on the PostHog-native sources (the inbox's "Responders") that match what this product actually uses, per your step-2 checklist. For most sources, conditional means conditional: one for a surface the product doesn't have just adds noise. **Error tracking, session replay, and support are the exception — enable them by default** (see the table): step 3b (Enable products) just turned all three products ON, so wire their sources to match even with no current signal. An idle source costs nothing until data arrives.

## Status

Emit:

```
[STATUS] Enabling signal sources
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__inbox-source-configs-create,mcp__posthog-wizard__inbox-source-configs-partial-update,mcp__posthog-wizard__inbox-source-configs-list`.

## The write recipe (use for every source here and in step 5)

1. List the current sources with `inbox-source-configs-list` (step 1 no longer pre-fetches them — get the current rows here).
2. Row exists and `enabled: true` → leave it alone, record "already enabled".
3. Row exists and `enabled: false` → `inbox-source-configs-partial-update` with `{ enabled: true }`.
4. No row → `inbox-source-configs-create` with `{ source_product, source_type, enabled: true }`. A 400 about uniqueness means a row appeared since you listed — fall back to 3.
5. Any other failure → record it as a follow-up and move on; a single failed source never stops the run.

## Enable

| Source | When | Payload |
|---|---|---|
| Scout gate | **Always** — it lets the step-6 troop's findings reach the inbox | `signals_scout` / `cross_source_issue` |
| Error tracking | **Enable by default**, even with no current signal — teams adopt error tracking sooner or later, and with no errors there are no findings and no cost. Evidence (report, exception autocapture ON, or error issues from the step-2 probe) only raises confidence; its absence is **not** a reason to skip | **All three rows**: `error_tracking` / `issue_created`, `error_tracking` / `issue_reopened`, `error_tracking` / `issue_spiking` — the product UI treats them as one switch |
| Session replay | **Enable by default**, same reasoning — arm it now even with no current signal; recordings are only analyzed once they exist, so an idle source costs nothing and teams turn replay on eventually. Evidence (recording opt-in ON, recordings from the step-2 probe, or the report) only raises confidence; its absence is **not** a reason to skip | `session_replay` / `session_analysis_cluster` — don't pass a `config`; the server injects the default sample rate. A 400 mentioning AI approval is unexpected (approval is enforced upstream) → skip this source and record a follow-up |
| Support | **Enable by default** — step 3b turned the Conversations product ON, so wire its source. It stays idle until an inbound channel (email / inbox / Slack) is connected, so record that channel connection as a follow-up — but enabling the source now means tickets reach the inbox automatically once a channel exists, with no second setup. Don't gate on profile evidence. | `conversations` / `ticket` |

## Skip — do not create

- `llm_analytics` (internal-only, not a user-facing responder)
- `logs` (not a v1 responder)
- Anything with `source_type` `evaluation` or `alert_state_change`
- The connected-tool sources (`github`, `linear`, `zendesk`, `pganalyze`) — those are step 5, ask-first.

Record every enable/skip decision with its reason — the report needs them.
