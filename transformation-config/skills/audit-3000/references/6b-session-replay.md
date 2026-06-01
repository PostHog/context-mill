---
next_step: 7-customer-enrichment.md
---

# Step 6b — Session replay

This step audits session replay correctness (**fix**, codebase-only) and cost-optimization (**optimize**, PostHog MCP where available) in **two parallel waves**. Eight check IDs in total, organized into two ledger areas:

**Session Replay** (fix):

- `replay-minimum-duration-set`
- `replay-mask-config`
- `replay-disabled-in-test-envs`
- `replay-strict-minimum-duration`

**Session Replay — Optimize** (cost):

- `replay-sampling-rate`
- `replay-triggers-configured`
- `replay-network-recording-filtered`
- `replay-mobile-sampling`

Two optimize checks (`replay-sampling-rate`, `replay-triggers-configured`) require PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure <signal>"` plus `"mcp_skipped": true` in the JSON. Do not block the audit.

**Each step gracefully handles a missing check id**: if the ledger doesn't include an expected id (older wizard), skip its `audit_resolve_checks` call for that id and continue.

## Status

Emit:

```
[STATUS] Detecting PostHog session replay configuration
[STATUS] Auditing session replay correctness
[STATUS] Auditing session replay cost optimization
```

## Action

### a. Presence detector

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. `sessionRecording|session_recording|disable_session_recording|startSessionRecording|enableSessionReplay` — any session replay API or config across runtimes (web, mobile, wrapper utils).
2. `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — any PostHog initialization across runtimes.

Step 1 (`1-version.md`) already aborts if no SDK is present — assume PostHog is installed. The presence detector here just decides how to scope the rest of the step:

- **Both greps return zero hits anywhere:** unusual (Step 1 would normally have aborted), but if so — resolve all 8 checks with `pass` and `details: "skip: no PostHog init found"`. Skip §b and §c.
- **Init found, replay APIs not found:** continue to §b and §c. Optimize-side MCP checks may still produce findings via project settings. Fix-side checks largely resolve to "skip: replay explicitly disabled" or "no replay config — default applies".
- **Both found:** continue normally.

Do not read any files in this sub-step. Do not call `audit_resolve_checks` here (the subagents will).

### b. Dispatch fix-side subagents (4 in parallel)

Make **four `Agent` tool calls in a single message** so they run concurrently. Wait for all four to return, then dispatch the optimize-side subagents (§c). Do not run any other tools between dispatch and the next wave.

The bundled `how-to-control-which-sessions-you-record.md` reference holds PostHog's authoritative guidance on minimum duration, strict mode, sampling, and triggers. It's typically at `.claude/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`. Each subagent reads it once before judging.

#### Task A — `replay-minimum-duration-set`

`description`: `Audit replay-minimum-duration-set`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-minimum-duration-set.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`). Focus on the "Minimum duration" section — without a minimum, every bounce session is recorded, inflating ingestion and storage costs while producing recordings that are too short to be useful.

Run **two** Greps in parallel:
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — locate every PostHog initialization.
- `minimumDurationMilliseconds|minimum_duration_milliseconds|minDurationMs` — any minimum duration config in the codebase.

Read each file that contains an init hit, once. For each init, inspect the `session_recording` / `sessionRecording` options object (web) or the mobile equivalent. Determine whether a minimum duration is set.

Rule:
- pass: every init that enables session replay sets `minimumDurationMilliseconds` (or `minimum_duration_milliseconds` on mobile) to a positive value.
- suggestion: replay is enabled but no minimum duration is set anywhere — bounce sessions get recorded, wasting ingestion. Recommend setting at least 2000ms.
- pass with details: "skip: replay explicitly disabled" — if every init disables replay.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-minimum-duration-set`, including `file` (path:line of the most relevant init or existing config) and `details` (one-line explanation including the current value if set). Return when the call completes. Do not write the audit report.
```

#### Task B — `replay-mask-config`

`description`: `Audit replay-mask-config`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-mask-config.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`). The default in posthog-js is `maskAllInputs: true`, which masks every `<input>` value. Explicitly setting `maskAllInputs: false` on a project that handles PII (forms, signup, payment, account) is a privacy / compliance risk.

Run **two** Greps in parallel:
- `maskAllInputs|maskTextSelector|maskInputOptions|mask_all_inputs` — any mask configuration site.
- `<input\b|<form\b|<Input\b|password|email|<TextField|<TextInput` — any form/PII surface in the codebase.

Read each file that contains a `maskAllInputs` hit, once. Determine whether `maskAllInputs: false` is set explicitly. Cross-reference with the form/PII grep — if the codebase has form/PII surfaces and `maskAllInputs: false` is set, that's a privacy risk.

Rule:
- pass: `maskAllInputs` is left at default (true) OR explicitly set to true OR set to false but the project has no form/PII surfaces detected.
- warning: `maskAllInputs: false` is set AND the project has form / input / password fields detected. Recommend reverting to default or using targeted `maskInputOptions` / `maskTextSelector` instead.
- pass with details: "no replay mask config; default (true) applies" — if no mask config is found.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-mask-config`, including `file` (path:line of the mask config or most relevant form site) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

#### Task C — `replay-disabled-in-test-envs`

`description`: `Audit replay-disabled-in-test-envs`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-disabled-in-test-envs.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`). Test and CI runs that don't disable session replay flood the recording pipeline with synthetic, useless sessions that consume your replay quota.

Run **three** Greps in parallel:
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — every PostHog initialization.
- `disable_session_recording|disableSessionRecording|sessionReplay\s*[:=]\s*false|enableSessionReplay\s*[:=]\s*false` — any explicit replay-disable site.
- `NODE_ENV\s*===\s*['\"]test['\"]|process\.env\.CI|process\.env\.NODE_ENV|import\.meta\.env\.MODE\s*===\s*['\"]test['\"]` — any test / CI environment gate.

Read each init file once. Determine whether a test/CI gate disables `session_recording` (or sets `disable_session_recording: true`) at init time. Also consider whether the project even ships in a test/CI context (look for `vitest.config`, `jest.config`, `playwright.config`, `.github/workflows`, etc. via Glob if needed).

Rule:
- pass: replay is gated off under `NODE_ENV === 'test'` or `CI` (or replay is enabled only in production paths).
- pass with details: "skip: no test/CI environment detected" — if no test/CI infrastructure exists in the project.
- suggestion: project has test/CI infrastructure AND replay-enabled init AND no environment gate — recommend gating `session_recording` (or `disable_session_recording`) on `NODE_ENV !== 'test'` && `!process.env.CI`.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-disabled-in-test-envs`, including `file` (path:line of the init that should be gated) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

#### Task D — `replay-strict-minimum-duration`

`description`: `Audit replay-strict-minimum-duration`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-strict-minimum-duration.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`). Focus on the "Strict mode" section: in `strictMinimumDuration: true` mode, minimum duration is checked against actual buffered continuous data, not session age. This better filters short bouncing sessions across page refreshes. It's currently opt-in and likely to become the default in a future SDK release.

Run **one** Grep: `strictMinimumDuration|strict_minimum_duration`. Also re-grep `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` to locate init files.

Read each file that contains an init hit, once. Determine whether `strictMinimumDuration: true` is set inside the `session_recording` config.

Rule:
- pass: `strictMinimumDuration: true` is explicitly set on every init that enables session replay.
- suggestion: replay is enabled but `strictMinimumDuration` is unset or `false` — recommend opting into strict mode now to filter bounces more accurately and future-proof against the upcoming default.
- pass with details: "skip: replay explicitly disabled" — if every init disables replay.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-strict-minimum-duration`, including `file` (path:line of the init or existing strictMinimumDuration site) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

### c. Dispatch optimize-side subagents (4 in parallel)

After all four fix-side tasks return, make **four `Agent` tool calls in a single message** for the optimize-side checks. Wait for all four to return, then continue to `7-customer-enrichment.md`. Do not run any other tools between dispatch and the next step.

The bundled `network-recording.md` reference holds PostHog's guidance on network/performance recording cost trade-offs, and `how-to-control-which-sessions-you-record.md` covers sampling and triggers. Both are typically under `.claude/skills/audit-3000/references/`; if those paths don't exist, discover with `Glob` `**/skills/audit-3000/references/<name>.md`. Each subagent reads the reference(s) relevant to its check once before judging.

#### Task A — `replay-sampling-rate`

`description`: `Audit replay-sampling-rate`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-sampling-rate.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure replay sampling rate"` plus `"mcp_skipped": true` in the JSON. Do not block the audit.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`). Focus on the "Sampling" section: sample rate is the deterministic per-session probability of recording. At 100% you record everything; large projects often cut volume meaningfully by sampling to 10-50%.

Step 1 — read project replay settings via MCP. Try `mcp__posthog__project-set-active` then any project-settings read tool (e.g. `mcp__posthog__project-settings-get` or similar). If no specific tool exists, fall back to `mcp__posthog__execute-sql` to estimate recording volume:

```sql
SELECT count() AS replay_events_7d
FROM events
WHERE event = '$snapshot'
  AND timestamp > now() - INTERVAL 7 DAY
```

Step 2 — judge:
- pass: project `sample_rate < 1.0` (sampling is active), OR `sample_rate == 1.0` but recording volume is low (`replay_events_7d < 100000`).
- suggestion: `sample_rate >= 1.0` AND recording volume is high (`replay_events_7d >= 100000`) — recommend lowering sampling. Quote the actual volume in details.
- suggestion + mcp_skipped: MCP unavailable — recommend the operator review their sample rate manually in https://us.posthog.com/replay/settings.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-sampling-rate`, with `file` left blank (this finding is not tied to a code site — it's a project-level setting), and `details` as compact JSON:

```
{
  "sample_rate": <0.0-1.0 or null>,
  "replay_events_7d": <N or null>,
  "recommendation": "keep | lower-sampling | review-manually",
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

#### Task B — `replay-triggers-configured`

`description`: `Audit replay-triggers-configured`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-triggers-configured.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure replay triggers"` plus `"mcp_skipped": true` in the JSON. Do not block the audit.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`). Focus on the "URL trigger conditions", "Event trigger conditions", and "With feature flags" sections. Triggers let you record only sessions that hit a particular page, fire a particular event (like an exception), or match a feature flag — far cheaper than recording 100% of sessions for a high-volume project.

Step 1 — read project replay-triggers settings via MCP. Try whatever project-settings read tool is available (e.g. `mcp__posthog__project-settings-get`). The settings of interest are URL triggers, event triggers, and the linked feature flag for recordings.

Step 2 — estimate recording volume to gauge whether triggers would help:

```sql
SELECT count() AS replay_events_7d
FROM events
WHERE event = '$snapshot'
  AND timestamp > now() - INTERVAL 7 DAY
```

Step 3 — judge:
- pass: at least one URL trigger, event trigger, or recording feature flag is configured.
- pass with details: "skip: low recording volume" — triggers empty/null but `replay_events_7d < 100000` (volume too low to justify trigger setup).
- suggestion: triggers empty/null AND `replay_events_7d >= 100000` — recommend configuring an event trigger (e.g. exception event) or URL trigger (e.g. checkout funnel) to focus recording budget.
- suggestion + mcp_skipped: MCP unavailable.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-triggers-configured`, with `file` left blank, and `details` as compact JSON:

```
{
  "url_trigger_count": <N or null>,
  "event_trigger_count": <N or null>,
  "linked_flag": "<flag key or null>",
  "replay_events_7d": <N or null>,
  "recommendation": "keep | add-triggers | review-manually",
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

#### Task C — `replay-network-recording-filtered`

`description`: `Audit replay-network-recording-filtered`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-network-recording-filtered.

Read this skill's bundled `network-recording.md` reference once (typically `.claude/skills/audit-3000/references/network-recording.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/network-recording.md`). Capturing network requests and responses inside replay can be very useful for debugging, but unfiltered payloads can balloon recording size (especially when the project's XHR/fetch responses are large JSON blobs).

Run **two** Greps in parallel:
- `captureNetworkRequests|capturePerformance|recordHeaders|recordBody|capture_network_telemetry` — any network/performance recording flags.
- `maskNetworkRequestFn|maskRequestFn|maskCapturedNetworkRequestFn|payloadHostDenyList|payloadSizeLimitBytes` — any payload-filtering configuration.

Read each file that contains a `captureNetworkRequests` / `capturePerformance` hit, once. Determine whether network/performance capture is enabled, and if so, whether payload filtering is also configured.

Rule:
- pass: network/performance capture is disabled OR enabled with payload filtering (`maskNetworkRequestFn`, `payloadHostDenyList`, or `payloadSizeLimitBytes`) configured.
- suggestion: `captureNetworkRequests: true` OR `capturePerformance: true` is set AND no payload filtering is configured — recommend adding `maskNetworkRequestFn` to strip bodies / sensitive headers and cap payload size.
- pass with details: "no network recording config detected" — if neither flag is set.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-network-recording-filtered`, including `file` (path:line of the network capture config) and `details` as compact JSON:

```
{
  "capture_network_requests": <true|false|null>,
  "capture_performance": <true|false|null>,
  "payload_filtering_configured": <true|false>,
  "recommendation": "keep | add-payload-filtering"
}
```

Return when the call completes. Do not write the audit report.
```

#### Task D — `replay-mobile-sampling`

`description`: `Audit replay-mobile-sampling`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-mobile-sampling.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/how-to-control-which-sessions-you-record.md`). Focus on the sampling support matrix — iOS 3.42.0+, Android 3.34.0+, React Native 4.37.0+ all support session-level sampling. Mobile session replays are larger per-session than web; running 100% sampling on mobile is usually the most expensive surface in a multi-runtime PostHog setup.

Run **two** Greps in parallel:
- `sessionReplay\s*[:=]\s*true|enableSessionReplay\s*[:=]\s*true|session_replay_config|PostHogConfig\(|PostHogReactNative` — mobile SDK replay-enable sites (iOS / Android / RN naming conventions).
- `sessionSampling|sample_rate|sessionReplaySampleRate|replaySampleRate` — any mobile sampling config.

Read each file that contains a mobile replay-enable hit, once. Determine whether the mobile init enables session replay without setting a sampling rate.

Rule:
- pass: every mobile SDK init that enables session replay also sets a sampling rate < 1.0 OR no mobile SDK is present.
- pass with details: "skip: no mobile SDK detected" — if the codebase has no iOS/Android/RN PostHog init.
- suggestion: mobile SDK init enables session replay AND no sampling rate is set — recommend sampling (mobile replays are larger per-session than web).

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-mobile-sampling`, including `file` (path:line of the most relevant mobile init) and `details` as compact JSON:

```
{
  "mobile_runtimes_detected": ["ios" | "android" | "react-native", ...],
  "replay_enabled_without_sampling": <true|false>,
  "recommendation": "keep | add-mobile-sampling | n/a"
}
```

Return when the call completes. Do not write the audit report.
```

## After all eight return

Continue to **`7-customer-enrichment.md`**. Do not write the report yet — that's Step 10's job after the later steps finish.
