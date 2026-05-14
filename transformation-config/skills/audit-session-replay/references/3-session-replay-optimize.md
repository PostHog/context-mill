---
next_step: 4-report.md
---

# Step 3 — Session replay (optimize)

This step resolves four cost-optimization checks **in parallel**, one subagent per check:

- `replay-sampling-rate`
- `replay-triggers-configured`
- `replay-network-recording-filtered`
- `replay-mobile-sampling`

Two of them require PostHog MCP access to read the project's replay settings. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure <signal>"` plus `"mcp_skipped": true` in the JSON details. Do not block the audit.

## Status

Emit before dispatching:

```
[STATUS] Auditing session replay cost optimization
```

## Action — dispatch four subagents in one message

Make **four `Task` tool calls in a single message** so they run concurrently. Wait for all four to return, then continue to `4-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `network-recording.md` reference holds PostHog's guidance on network/performance recording cost trade-offs, and `how-to-control-which-sessions-you-record.md` covers sampling and triggers. Both are typically under `.claude/skills/audit-session-replay/references/`; if those paths don't exist, discover with `Glob` `**/skills/audit-session-replay/references/<name>.md`. Each subagent reads the reference(s) relevant to its check once before judging.

### Task A — `replay-sampling-rate`

`description`: `Audit replay-sampling-rate`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-sampling-rate.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure replay sampling rate"` plus `"mcp_skipped": true` in the JSON. Do not block the audit.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`). Focus on the "Sampling" section: sample rate is the deterministic per-session probability of recording. At 100% you record everything; large projects often cut volume meaningfully by sampling to 10-50%.

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

### Task B — `replay-triggers-configured`

`description`: `Audit replay-triggers-configured`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-triggers-configured.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure replay triggers"` plus `"mcp_skipped": true` in the JSON. Do not block the audit.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`). Focus on the "URL trigger conditions", "Event trigger conditions", and "With feature flags" sections. Triggers let you record only sessions that hit a particular page, fire a particular event (like an exception), or match a feature flag — far cheaper than recording 100% of sessions for a high-volume project.

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

### Task C — `replay-network-recording-filtered`

`description`: `Audit replay-network-recording-filtered`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-network-recording-filtered.

Read this skill's bundled `network-recording.md` reference once (typically `.claude/skills/audit-session-replay/references/network-recording.md`; otherwise discover with `Glob` `**/skills/audit-session-replay/references/network-recording.md`). Capturing network requests and responses inside replay can be very useful for debugging, but unfiltered payloads can balloon recording size (especially when the project's XHR/fetch responses are large JSON blobs).

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

### Task D — `replay-mobile-sampling`

`description`: `Audit replay-mobile-sampling`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-mobile-sampling.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`). Focus on the sampling support matrix — iOS 3.42.0+, Android 3.34.0+, React Native 4.37.0+ all support session-level sampling. Mobile session replays are larger per-session than web; running 100% sampling on mobile is usually the most expensive surface in a multi-runtime PostHog setup.

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

## After all four return

Continue to **`4-report.md`**.
