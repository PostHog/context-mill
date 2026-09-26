---
next_step: 6b-tailor-scouts.md
---

# Step 6 — Configure the scout troop

Scouts are the pull side of Signals: scheduled agents that scan the project on an interval and emit findings as `signals_scout` / `cross_source_issue` signals (which reach the inbox by default — step 4's scout gate row exists only as an opt-out). Every enabled scout is a recurring LLM spend — it costs a full run every tick even when it finds nothing — so the troop is kept **deliberately selective**: the `general` scout, plus the **three to five specialists** for the products this project uses most. Everything else is disabled.

**The whole troop shares one ceiling of about ten enabled scouts** — `general` + 3–5 specialists from this step + 3–5 custom scouts from step 6b, traded against each other so the total stays at or under ten. That ceiling is about quality, not cost: across the fleet, the share of runs that produce a finding holds steady from roughly five to ten enabled scouts and then drops by about half past ten, because a troop that big stops being selective about which surfaces it watches.

Scout runs are also budgeted server-side: a project gets up to **100 scout runs a day by default** during early access (per-team overrides exist, and `scout-metadata-get` reports the enforced numbers). At the default daily cadence one enabled scout ≈ one run a day, so a ten-scout troop uses about a tenth of the budget. **The run budget is a backstop, not the sizing input** — size the troop against the ceiling above, and only consult the budget when it is unusually low (see 1b).

The server also caps how many scouts a project can have **enabled at once** (`max_enabled_scouts` in `scout-metadata-get`). The code default is far above ten, but a project or fleet override can set it lower. The server rejects any enable past that cap, including the enables in this step and in step 6b. Every enabled config counts toward it: the operational scouts, custom scouts the team already has, and the troop. So the cap can bind before the ten-scout ceiling does — step 1b reads it.

**Operational scouts are not part of the troop.** A few rows come back from `scout-config-sync` with `scout_role: "operational"` — today `signals-scout-inbox-validation`. They watch the self-driving system itself rather than a product surface: inbox validation is the lane that runs every follow-up check a report schedules, and those checks start arriving with the first reports, so a fresh project needs it as much as an old one. The server seeds them enabled and outside the ten-scout ceiling, even when the project is at its enabled-scout cap. They still count toward that cap, so each enabled operational scout uses one of its slots. Keep them enabled: a disabled operational scout ends every check on its lane as errored. Earlier versions of this setup disabled inbox validation, and `scout-config-sync` does not reset an existing row, so on a rerun you may find one off — step 3 turns it back on. If a row has no `scout_role` field (older PostHog deploy), treat `signals-scout-inbox-validation` as operational by name.

## Status

Emit:

```
[STATUS] Configuring the scout troop
```

## Tools

Reach the scout-config tools through the PostHog `exec` tool — `info` then `call` for `scout-config-sync`, `scout-config-list`, `scout-config-update`, and `scout-metadata-get`.

## Do

1. **Materialize**: call `scout-config-sync`. It is idempotent — it seeds the built-in scout skills for this team and creates any missing configs, then returns the troop.

   **Soft-degrade if the tool is missing or fails**: fall back to `scout-config-list`. If that returns rows, tune those. If it returns nothing, the troop hasn't been materialized yet — record a follow-up ("the scout troop materializes automatically within ~30 minutes; tune it later in PostHog or re-run this setup"), still run step 1b so the report can state the run budget, and continue to step 7. **Not an abort.**

1b. **Read the run budget**: call `scout-metadata-get`. It returns the enforced limits (`max_runs_per_day` — `null` means unbounded — plus `runs_today` and `runs_remaining_today`) and any announcement banner. Record the limits and the banner text for the report. At the default budget the ceiling that binds is the **ten-scout troop**, not the run budget, so size the pick against that and treat this read as a check that nothing unusual is in force. **Only if the budget is genuinely low, shrink the pick to fit**: when `max_runs_per_day` is under ~10 (remember step 6b adds custom scouts at the same cadence), enable fewer specialists so the whole enabled set fits inside it, leaving a run or two a day for the operational scouts (their check runs draw from the same budget) — `general` + one specialist is the usual floor, and only when even that exceeds the budget fall back to `general` alone and note it in the report. **Soft-degrade if the tool is missing or fails** (older PostHog deploy): size against the ten-scout ceiling as usual and continue. **Not an abort.** In the report, say the budget could not be read and quote 100/day as the published default rather than as this project's verified limit — you did not read it, so do not state it as fact.

1c. **Count the free enabled-scout slots.** Read `max_enabled_scouts` from the same `scout-metadata-get` response. From the `scout-config-sync` rows, count the enabled rows this setup keeps on whatever it picks: the operational scouts, and every enabled custom scout (`scout_origin: "custom"`). Then:

   `slots = max_enabled_scouts − (enabled operational scouts) − (enabled custom scouts)`

   `slots` is the number of non-operational, non-custom scouts this step and step 6b can have enabled **together**. Cap the pick in step 2 so `general` + the specialists fit inside `slots`, and remember step 6b needs room from the same number. At the default cap `slots` is far above ten, so the ten-scout ceiling still binds and nothing changes. When `slots` is small, drop specialists first (least-used first), then `general` only if `slots` is 1 or less — with `slots` at 1 keep `general` alone, and with `slots` at 0 enable no troop scout at all. Whenever `slots` removes a scout you would otherwise enable, record a follow-up: "This project can have at most N scouts enabled at once, and M slots were already in use. Ask PostHog to raise the project's `max_enabled_scouts`, or disable a scout you no longer need, then enable `<scout>`." Record `max_enabled_scouts` and `slots` for the report. **Soft-degrade** if the field is absent (older PostHog deploy): skip this bound and size against the ten-scout ceiling and the run budget as usual.

2. **Decide the enabled set — the whole point of this step is to enable FEW scouts, not many.** Work from the rows `scout-config-sync` actually returned (the troop grows over time — ~19 scouts today — so never hardcode a list). The enabled set has exactly three parts:

   **(a) `general` — always enabled.** `signals-scout-general` watches cross-product correlations and the surfaces no specialist covers; it self-closes cheaply when there's nothing to say. Keep it on for every project.

   **(b) Two surfaces are routed elsewhere, so their scouts stay off.** Error tracking reaches the inbox as step 4's native **source**; session replay reaches it through the Replay Vision **scanners** of step 6c. One surface, one route — so `signals-scout-error-tracking` and `signals-scout-session-replay` are already covered, and a scout on top of either produces the same finding twice. They end this step disabled whatever the evidence says, and the report records them as covered by their route — error tracking by the native source, session replay by the scanners — which is what they are, rather than as a re-enable follow-up.

   **(c) Up to five specialists — for the products this project uses MOST.** This is a judgment call, not a checklist: weigh ALL the step-2 evidence together — the profile's `top_events` (volume + distinct users), recent activity, the active counts for feature flags / experiments / surveys / dashboards, plus any repo signals — and pick the product surfaces that are most actually used, then enable each one's scout. **Three to five is the normal case on a project with that many genuinely-used surfaces; it is a ceiling, not a quota.** A project that only really uses one or two eligible surfaces gets one or two — never pad the list to reach three (see the rules below, which still bind). The candidate pool is the entire troop **except** `general`, the two routed elsewhere in (b), and the operational scouts (see above); it includes both the surface-specific scouts and the remaining cross-product ones:

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
   | `signals-scout-replay-vision` | Replay Vision scanners the team **already** had before this run — the scanners step 6c creates later don't count, since this scout reads trends *across* accumulated observations and there are none yet |
   | `signals-scout-anomaly-detection` | (cross-product) anomalies in whatever time series exist |
   | `signals-scout-observability-gaps` | (cross-product) events with no insight coverage |
   | `signals-scout-health-checks` | (cross-product) PostHog setup health |

   Rules for the pick:
   - **At most five, and only as many as make sense.** Three or four is the norm; add a fifth only when a fifth surface is clearly, actively used. Even if six or more surfaces look used, keep only the five most-used — and remember step 6b needs room under the ten-scout ceiling, so taking all five here leaves it four. Padding the list with surfaces that are barely used is what drops findings per run.
   - **Inside the free slots.** `general` + the specialists never exceed `slots` from step 1c. This bound wins over "at least one" below.
   - **At least one.** Always end with a specialist enabled. If no product surface clearly stands out — e.g. the only products in use are error tracking / session replay (excluded in (b)), or the profile was unavailable and nothing is rankable — **fall back to one universal cross-product scout** (`signals-scout-anomaly-detection` or `signals-scout-health-checks`) as the stand-in.
   - **A scout the table doesn't name** (posthog keeps adding them): treat it as a specialist candidate — read its description, judge whether its surface is among this project's most-used, and enable it only if it earns one of the ≤5 slots.

3. **Disable every scout you did NOT enable** in (a)–(c) — this is now most of the troop. Skip the operational scouts: they are not yours to turn off here, and they stay enabled whatever (a)–(c) picked. Also skip every custom scout (`scout_origin: "custom"`): the team wrote it, so it keeps its current state. An enabled custom scout uses a slot (step 1c), but this step never disables it to free that slot.

   **Do the disables first, then the enables.** The server checks the enabled-scout cap against the count at the time of each enable. `scout-config-sync` can leave scouts enabled that this step turns off, so an enable sent before those disables can fail even when the final set fits. Enable a picked scout that came back disabled via `scout-config-update` with `{ enabled: true }`. If an enable still fails with the cap error, record the scout as a follow-up with the same text as step 1c, and continue. If an operational scout comes back with `enabled: false`, update it to `{ enabled: true }` instead, and note in the report that setup turned it back on. Disable via `scout-config-update` with the config `id` and `{ enabled: false }` — that one field is the whole update, since `emit` (dry-run posture) and `run_interval_minutes` keep the server's defaults, which are the intended posture. A failed update is a follow-up, not an abort.

   For each **surface-specific** scout you disabled, record a re-enable follow-up so the user can switch it on if they do use that surface later (e.g. "enable `signals-scout-logs` in PostHog if you use the logs product"). The error-tracking / session-replay disables come from the route map (see (b)) — those two are reported as covered by the native source and the Replay Vision scanners.

4. **Show the result.** This step asks the user nothing, so the only in-run visibility is the status line — after tuning, emit one naming the enabled set (short names, no `signals-scout-` prefix):

```
[STATUS] Scout troop: 4 active (general, product-analytics, feature-flags, surveys), plus 1 operational (inbox-validation); 14 disabled
```

(Adjust counts and names to the actual troop and your decisions — the enabled set is always `general` + the 3–5 specialists, so "4 active" through "6 active" is expected; the operational scouts are listed apart because they sit outside that count; error-tracking and session-replay sit among the disabled, routed elsewhere.)

Fresh configs have never run, so they're due immediately — the first scans fire on the next coordinator tick, within ~30 minutes, and each run draws from the project's daily budget (step 1b). Record per-scout decisions (enabled / disabled + why) and the budget numbers for the report.
