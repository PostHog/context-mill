---
next_step: 6b-tailor-scouts.md
---

# Step 6 — Configure the scout fleet

Scouts are the pull side of Signals: scheduled agents that scan the project on an interval and emit findings as `signals_scout` / `cross_source_issue` signals (which step 4's scout gate lets into the inbox). Materialize the fleet, then switch off the scouts whose product surface this project doesn't have.

## Status

Emit:

```
[STATUS] Configuring the scout fleet
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__signals-scout-config-sync,mcp__posthog-wizard__signals-scout-config-list,mcp__posthog-wizard__signals-scout-config-update`.

## Do

1. **Materialize**: call `signals-scout-config-sync`. It is idempotent — it seeds the canonical scout skills for this team and creates any missing configs, then returns the fleet.

   **Soft-degrade if the tool is missing or fails**: fall back to `signals-scout-config-list`. If that returns rows, tune those. If it returns nothing, the fleet hasn't been materialized yet — record a follow-up ("the scout fleet materializes automatically within ~30 minutes; tune it later in PostHog or re-run this setup") and continue to step 7. **Not an abort.**

2. **Tune — classify every scout the sync returned; don't assume a fixed list.** The fleet is seeded from posthog and grows over time (it's ~19 scouts today), so always work from the rows `signals-scout-config-sync` actually returned, not a hardcoded set. For each scout, read its name/description and ask **"does this project have the surface this scout watches?"** — that sorts it into one of two buckets:

   **Always-on (cross-product).** Its surface is "any project with data," so it self-closes cheaply when there's nothing to say. Keep enabled. Examples (illustrative, not exhaustive):

   - `signals-scout-general` — cross-product correlations and uncovered surfaces
   - `signals-scout-anomaly-detection` — anomalies in whatever time series exist
   - `signals-scout-observability-gaps` — events with no insight coverage
   - `signals-scout-health-checks` — PostHog setup health
   - `signals-scout-inbox-validation` — whether shipped fixes actually held

   **Surface-specific (conditional).** Tied to a product or surface a project may not have. **Enable ONLY when step 2 found positive evidence the surface is in use** — evidence on EITHER side counts: the repo scan OR the server-side state (project-state opt-ins and usage probes). A product enabled at the project level is evidence even when this repo shows nothing. No evidence → disable. Examples of surface → evidence (illustrative, not exhaustive):

   | Scout | Enable only with evidence of |
   |---|---|
   | `signals-scout-error-tracking` | error tracking in use — exception autocapture ON, error issues exist, or the repo instruments it (the same evidence step 4 uses for the error-tracking source) |
   | `signals-scout-session-replay` | session recording enabled (opt-in ON or recordings exist) |
   | `signals-scout-product-analytics` | funnels / retention / lifecycle insights or product events in use |
   | `signals-scout-web-analytics` | web traffic / pageviews with referrer or UTM tracking |
   | `signals-scout-feature-flags` | feature flags in use (frontend or backend) |
   | `signals-scout-surveys` | surveys opt-in ON or surveys found (step 2) |
   | `signals-scout-revenue-analytics` | a payment SDK / revenue data |
   | `signals-scout-ai-observability` | `$ai_*` events / LLM usage |
   | `signals-scout-logs` | the PostHog logs product in use |
   | `signals-scout-csp-violations` | CSP reporting configured |
   | `signals-scout-experiments` | active A/B experiments |
   | `signals-scout-customer-analytics` | group / accounts analytics (B2B), not a pure B2C app |
   | `signals-scout-data-pipelines` | CDP destinations, batch exports, or hog flows |
   | `signals-scout-replay-vision` | Replay Vision scanners configured |

   **A scout neither list names** (posthog keeps adding them): classify it by the same question — read its description and decide whether its surface is product-agnostic (→ always-on) or tied to a surface you must confirm (→ conditional, evidence required). When unsure whether a surface-specific scout's surface exists, treat that as no evidence.

   **"Unknown" is not evidence → disable the scout.** Unlike a dormant warehouse responder (gated on a sync, so it never fires for free), a scout runs on its schedule and costs a full LLM run every tick even when it finds nothing — so never pay for a surface you can't confirm exists. For every conditional scout you disable, record a re-enable follow-up so the user can switch it on if they do use that surface (e.g. "enable `signals-scout-logs` in PostHog if you use the logs product").

3. Disable via `signals-scout-config-update` with the config `id` and `{ enabled: false }` — **nothing else**. Don't touch `emit` (dry-run posture) or `run_interval_minutes`; defaults are correct for a fresh fleet. A failed update is a follow-up, not an abort.

4. **Show the result.** This step asks the user nothing, so the only in-run visibility is the status line — after tuning, emit one with the outcome (short scout names, no `signals-scout-` prefix):

```
[STATUS] Scout fleet: 12 active, disabled: ai-observability, revenue-analytics, logs, csp-violations, customer-analytics, data-pipelines, experiments, replay-vision
```

(Adjust counts and names to the actual fleet the sync returned and the decisions you made — fleet size varies as posthog adds scouts. If nothing was disabled, say "N active, none disabled".)

Fresh configs have never run, so they're due immediately — the first scans fire on the next coordinator tick, within ~30 minutes. Record per-scout decisions (kept / disabled + why) for the report.
