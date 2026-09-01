---
next_step: 5-connected-tools.md
---

# Step 4 — Enable native signal sources

Switch on the PostHog-native sources (the inbox's "Responders") that match what this product actually uses, per your step-2 checklist. For most sources, conditional means conditional: one for a surface the product doesn't have just adds noise. **Error tracking and support are the exception — enable them by default** (see the table): step 3 (Enable products) just turned both products ON, so wire their sources to match even with no current signal. An idle source costs nothing until data arrives. Session replay has no source to enable here — recordings reach the inbox through the Replay Vision scanners you create in step 6c.

## Status

Emit:

```
[STATUS] Enabling signal sources
```

## Tools

Reach the source-config tools through the PostHog `exec` tool — `info` then `call` for `inbox-source-configs-create`, `inbox-source-configs-partial-update`, and `inbox-source-configs-list`.

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
| Health checks | **Always** — instrumentation issues (missing events, proxy gaps, outdated SDKs) are always actionable and a good thing for the agent to fix | `health_checks` / `health_issue` |
| Error tracking | **Enable by default**, even with no current signal — teams adopt error tracking sooner or later, and with no errors there are no findings and no cost. Evidence (report, exception autocapture ON, or error issues from the step-2 probe) only raises confidence; its absence is **not** a reason to skip | **All three rows**: `error_tracking` / `issue_created`, `error_tracking` / `issue_reopened`, `error_tracking` / `issue_spiking` — the product UI treats them as one switch |
| Support | **Enable by default** — step 3 turned the Conversations product ON, so wire its source. It stays idle until an inbound channel (email / inbox / Slack) is connected, so record that channel connection as a follow-up — but enabling the source now means tickets reach the inbox automatically once a channel exists, with no second setup. Don't gate on profile evidence. | `conversations` / `ticket` |

## Nothing to create here

The rest of the pairs have no row for this run to write. Each one's coverage lives somewhere else:

| Pair | Where its coverage lives |
|---|---|
| `session_replay` / `session_analysis_cluster` | Step 6c's Replay Vision scanners. This pair is **retired** — the session summarization feature behind it is gone, PostHog deleted the existing rows, and the server now skips the pair when it checks whether a team has a working source, so a row written here is a dead switch in the user's inbox. |
| `replay_vision` | The scanners themselves. Replay Vision is **self-authorizing**: `emits_signals` on each scanner *is* its per-source config, so step 6c's writes are the whole story. |
| `llm_analytics` | Nowhere — it's internal, with no user-facing responder behind it. |
| `logs`, plus any `source_type` of `evaluation` or `alert_state_change` | Nowhere yet — no v1 responder. |
| `github`, `linear`, `zendesk`, `pganalyze`, `jira`, `google_search_console`, … | Step 5, on the user's answer, once each tool's warehouse source exists. |

Record every source decision with its reason — the report needs them.
