---
next_step: 6b-tailor-scouts.md
---

# Step 6 — Configure the scout troop

Scouts are the pull side of Signals: scheduled agents that scan the project on an interval and emit findings as `signals_scout` / `cross_source_issue` signals (which step 4's scout gate lets into the inbox). Every enabled scout is a recurring LLM spend — it costs a full run every tick even when it finds nothing — so the troop is kept **deliberately small**: the `general` scout, plus the **one or two specialists** for the products this project uses most. Everything else is disabled.

## Status

Emit:

```
[STATUS] Configuring the scout troop
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__signals-scout-config-sync,mcp__posthog-wizard__signals-scout-config-list,mcp__posthog-wizard__signals-scout-config-update`.

## Do

1. **Materialize**: call `signals-scout-config-sync`. It is idempotent — it seeds the built-in scout skills for this team and creates any missing configs, then returns the troop.

   **Soft-degrade if the tool is missing or fails**: fall back to `signals-scout-config-list`. If that returns rows, tune those. If it returns nothing, the troop hasn't been materialized yet — record a follow-up ("the scout troop materializes automatically within ~30 minutes; tune it later in PostHog or re-run this setup") and continue to step 7. **Not an abort.**

2. **Decide the enabled set — the whole point of this step is to enable FEW scouts, not many.** Work from the rows `signals-scout-config-sync` actually returned (the troop grows over time — ~19 scouts today — so never hardcode a list). The enabled set has exactly three parts:

   **(a) `general` — always enabled.** `signals-scout-general` watches cross-product correlations and the surfaces no specialist covers; it self-closes cheaply when there's nothing to say. Keep it on for every project.

   **(b) Never enable the `error-tracking` or `session-replay` scouts.** Step 4 already enables error tracking and session replay as native **sources** — their findings reach the inbox through that pipeline, so a scout on the same surface only duplicates it. Disable `signals-scout-error-tracking` and `signals-scout-session-replay` unconditionally, regardless of evidence. This is an **intentional** exclusion, not an evidence gap, so do **not** record a re-enable follow-up for them — note them as "covered by the native source".

   **(c) One or two specialists — for the products this project uses MOST.** This is a judgment call, not a checklist: weigh ALL the step-2 evidence together — the profile's `top_events` (volume + distinct users), recent activity, the active counts for feature flags / experiments / surveys / dashboards, plus any repo signals — and pick the **one or two** product surfaces that are most actually used, then enable each one's scout. The candidate pool is the entire troop **except** `general` and the two excluded in (b); it includes both the surface-specific scouts and the remaining cross-product ones:

   | Scout | Specialist for |
   |---|---|
   | `signals-scout-product-analytics` | funnels / retention / lifecycle insights or heavy product-event usage |
   | `signals-scout-web-analytics` | web traffic / pageviews with referrer or UTM tracking |
   | `signals-scout-feature-flags` | feature flags in active use (frontend or backend) |
   | `signals-scout-surveys` | surveys in use |
   | `signals-scout-revenue-analytics` | a payment SDK / revenue data |
   | `signals-scout-ai-observability` | `$ai_*` events / LLM usage |
   | `signals-scout-logs` | the PostHog logs product in use |
   | `signals-scout-csp-violations` | CSP reporting configured |
   | `signals-scout-experiments` | active A/B experiments |
   | `signals-scout-customer-analytics` | group / accounts analytics (B2B) |
   | `signals-scout-data-pipelines` | CDP destinations, batch exports, or hog flows |
   | `signals-scout-replay-vision` | Replay Vision scanners configured |
   | `signals-scout-anomaly-detection` | (cross-product) anomalies in whatever time series exist |
   | `signals-scout-observability-gaps` | (cross-product) events with no insight coverage |
   | `signals-scout-health-checks` | (cross-product) PostHog setup health |
   | `signals-scout-inbox-validation` | (cross-product) whether shipped fixes actually held |

   Rules for the pick:
   - **At most two.** Even if three or more surfaces look used, keep only the two most-used. Enabling more re-creates the cost problem this step exists to prevent.
   - **At least one.** Always end with a specialist enabled. If no product surface clearly stands out — e.g. the only products in use are error tracking / session replay (excluded in (b)), or the profile was unavailable and nothing is rankable — **fall back to one universal cross-product scout** (`signals-scout-anomaly-detection` or `signals-scout-health-checks`) as the stand-in. Avoid `signals-scout-inbox-validation` as the fallback on a fresh setup — there are no shipped fixes for it to validate yet.
   - **A scout the table doesn't name** (posthog keeps adding them): treat it as a specialist candidate — read its description, judge whether its surface is among this project's most-used, and enable it only if it earns one of the ≤2 slots.

3. **Disable every scout you did NOT enable** in (a)–(c) — this is now most of the troop. Disable via `signals-scout-config-update` with the config `id` and `{ enabled: false }` — **nothing else**. Don't touch `emit` (dry-run posture) or `run_interval_minutes`; the defaults are correct. A failed update is a follow-up, not an abort.

   For each **surface-specific** scout you disabled, record a re-enable follow-up so the user can switch it on if they do use that surface later (e.g. "enable `signals-scout-logs` in PostHog if you use the logs product"). The error-tracking / session-replay disables are intentional (see (b)) — note them as "covered by the native source", not as a re-enable follow-up.

4. **Show the result.** This step asks the user nothing, so the only in-run visibility is the status line — after tuning, emit one naming the enabled set (short names, no `signals-scout-` prefix):

```
[STATUS] Scout troop: 3 active (general, product-analytics, feature-flags); 16 disabled
```

(Adjust counts and names to the actual troop and your decisions — the enabled set is always `general` + the 1–2 specialists, so "2 active" or "3 active" is expected; error-tracking and session-replay are deliberately among the disabled.)

Fresh configs have never run, so they're due immediately — the first scans fire on the next coordinator tick, within ~30 minutes. Record per-scout decisions (enabled / disabled + why) for the report.
