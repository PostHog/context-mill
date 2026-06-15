---
next_step: 7b-tailor-scouts.md
---

# Step 7 — Configure the scout fleet

Scouts are the pull side of Signals: scheduled agents that scan the project on an interval and emit findings as `signals_scout` / `cross_source_issue` signals (which step 5's scout gate lets into the inbox). Materialize the fleet, then switch off the scouts whose product surface this project doesn't have.

## Status

Emit:

```
[STATUS] Configuring the scout fleet
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__signals-scout-config-sync,mcp__posthog-wizard__signals-scout-config-list,mcp__posthog-wizard__signals-scout-config-update`.

## Do

1. **Materialize**: call `signals-scout-config-sync`. It is idempotent — it seeds the canonical scout skills for this team and creates any missing configs, then returns the fleet.

   **Soft-degrade if the tool is missing or fails**: fall back to `signals-scout-config-list`. If that returns rows, tune those. If it returns nothing, the fleet hasn't been materialized yet — record a follow-up ("the scout fleet materializes automatically within ~30 minutes; tune it later in PostHog or re-run this setup") and continue to step 8. **Not an abort.**

2. **Tune**: the canonical fleet is ten scouts. Keep the universal five enabled — they self-close cheaply when their surface is absent:

   - `signals-scout-general`
   - `signals-scout-error-tracking`
   - `signals-scout-anomaly-detection`
   - `signals-scout-observability-gaps`
   - `signals-scout-health-checks`

   **Enable a conditional scout only when step 2 found positive evidence its surface is in use** — evidence on EITHER side counts: the repo scan OR the server-side state (the project-state opt-ins and usage probes). A product enabled at the project level is evidence even when this repo shows nothing. No evidence → disable it (see the cost note below):

   | Scout | Enable only with evidence of |
   |---|---|
   | `signals-scout-revenue-analytics` | a payment SDK / revenue data |
   | `signals-scout-surveys` | surveys opt-in ON or surveys found (step 2) |
   | `signals-scout-ai-observability` | `$ai_*` events / LLM usage |
   | `signals-scout-logs` | the PostHog logs product in use |
   | `signals-scout-csp-violations` | CSP reporting configured |

   **"Unknown" is not evidence → disable the scout.** Unlike a dormant warehouse responder (gated on a sync, so it never fires for free), a scout runs on its schedule and costs a full LLM run every tick even when it finds nothing — so never pay for a surface you can't confirm exists. For every conditional scout you disable, record a re-enable follow-up so the user can switch it on if they do use that surface (e.g. "enable `signals-scout-logs` in PostHog if you use the logs product").

3. Disable via `signals-scout-config-update` with the config `id` and `{ enabled: false }` — **nothing else**. Don't touch `emit` (dry-run posture) or `run_interval_minutes`; defaults are correct for a fresh fleet. A failed update is a follow-up, not an abort.

4. **Show the result.** This step asks the user nothing, so the only in-run visibility is the status line — after tuning, emit one with the outcome (short scout names, no `signals-scout-` prefix):

```
[STATUS] Scout fleet: 5 active, disabled: revenue-analytics, surveys, ai-observability, logs, csp-violations
```

(adjust counts/names to the actual decisions; if nothing was disabled, say "10 active, none disabled").

Fresh configs have never run, so they're due immediately — the first scans fire on the next coordinator tick, within ~30 minutes. Record per-scout decisions (kept / disabled + why) for the report.
