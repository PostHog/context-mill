# Feature Flags Doctor — Remediation

Read this file at Phase 2 (to classify findings) and again in Phase 3 (to apply them). Nothing in it is applied until the user selects the finding in the confirm step.

How to fix each check's finding. Apply a fix **only** for findings the user selected in the confirm step, and make only the change described here.

Each finding has a **fix type**:

- **code** — edit the user's project (init options, flag call sites, env wiring via wizard-tools).
- **settings** — change PostHog state via the MCP flag-mutation tool. If no such tool is available, record it as manual guidance instead — do not fabricate a tool call.
- **manual** — environment- or app-specific. The doctor explains it in the report; the user acts. Not offered in the `wizard_ask` multi-select.

## The interlock, restated

When `ff-evaluated-not-reported` resolved as `warning` or `error` (`gates_cleanup: true`), every **settings** fix in this file is withheld from the multi-select — regardless of what other checks found. Staleness signals are computed from `$feature_flag_called` events; while those events aren't verifiably flowing, "unused" cannot be distinguished from "heavily used but unreported", and archiving on bad data turns off live features. Offer the `ff-evaluated-not-reported` code fix first; tenant cleanup happens on a future run once events are flowing.

## The safe cleanup order (from the cleaning-up-stale-flags guide)

A 100% rollout does not mean a flag is safe to disable — if deployed code still checks it, disabling turns the feature off for everyone. Therefore:

- Flags **still referenced in code** (`stale-<key>` rows): the doctor's fix is the CODE half only — remove the gate, keep the winning path. The report then instructs: deploy, verify, and only then disable the flag in PostHog. The doctor never disables a referenced flag.
- Flags with **zero code references** (`ff-active-but-unreferenced`): nothing checks them, so tenant-side archive/disable is safe immediately — with consent, and only when the interlock allows.

## Mapping

| Check / row | Fix type | Action |
| --- | --- | --- |
| `ff-key-authenticates` (missing/wrong key) | code | Wire the correct project token via `set_env_values`; never write `.env` directly. |
| `ff-key-authenticates` (personal key in client code) | manual | Explain the exposure; the user must rotate the key in PostHog and move server-side calls behind a backend. Never attempt the rotation. |
| `ff-flags-endpoint` (broken proxy route) | manual | Name the failing path + status; link the proxy docs. Proxy config is infrastructure — no automatic change. |
| `delivered-<key>` rows | manual | Per-flag explanation with the `reason` code and what it means; link troubleshooting docs. Targeting/rollout intent is the operator's call. |
| `ghost-<key>` rows | code | If a near-match roster key exists (report named it): fix the typo at the call site(s). If no similar flag exists: remove the dead call site's gate conservatively (keep the fallback path) or, when the surrounding code is non-trivial, downgrade to manual with the exact locations. |
| `ff-evaluated-not-reported` | code | Remove/condition the suppression so `$feature_flag_called` flows in production (keep legitimate test/CI gating intact). This fix is always offered FIRST when the interlock is active. |
| `ff-eval-before-identify` | code | Add re-evaluation after identify: subscribe via `onFeatureFlags` for the affected surface or call `reloadFeatureFlags()` after `identify()`. Minimal change; don't restructure auth flows. |
| `ff-bootstrap-when-known-set` | code | Set `bootstrap.featureFlags` from the known initial set at init. |
| `ff-await-readiness` | code | Gate the offending eval behind `onFeatureFlags`/`loaded`, or add bootstrap. One call site at a time. |
| `ff-default-values` | code | Add `?? <default>` at bare consumption sites. Choose the default that matches the pre-flag behavior (usually the fallback/control path). |
| `ff-bootstrap-distinct-id-mismatch` | code | Stabilize the bootstrapped id (use the value later passed to identify) or remove `bootstrap.distinctID` when no stable id exists pre-auth. |
| `ff-identified-only-pre-auth-targeting` | manual | Explain the anonymous-profile gap; options (property overrides at eval, server-computed bootstrap, move behind auth) are product decisions. |
| `stale-<key>` rows | code | Strip the gate, keep the enabled/winning path (multivariate: keep the winning variant), remove dead imports/branches. Report adds the deploy-then-disable instruction. NEVER touch the flag in PostHog. |
| `ff-active-but-unreferenced` | settings | Archive (preferred) or disable each selected flag via the MCP flag-mutation tool. Gated by the interlock. If no mutation tool is available, list the exact flags + link the flags page as manual guidance. |
| `ff-local-eval-polling-interval` | code | Set `featureFlagsPollingInterval` (or language equivalent) to ≥300000 ms with a one-line comment stating the tradeoff. |
| `ff-local-eval-in-edge-handlers` | manual | Explain per-invocation init cost; regular evaluation or an external definitions cache are architecture choices. |
| `ff-test-ci-gating` | code | Guard init (or spread `advanced_disable_feature_flags: true` / `preloadFeatureFlags: false`) under the project's existing test/CI detection pattern. |

## Per-fix rules

- **One finding, one minimal change.** Never batch unrelated edits into one fix. Never reformat surrounding code.
- **Code removals are conservative.** When stripping a gate, if the else-branch contains logic that is not obviously dead (side effects, cleanup, telemetry), downgrade to manual and say why in the report.
- **Settings mutations name exactly what changed** — flag key + old state → new state — in "Fixes applied".
- **Environment fixes** go through `set_env_values` only, and the report never prints the value.
