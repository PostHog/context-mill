---
next_step: 3-session-replay-optimize.md
---

# Step 2 — Session replay (fix)

This step resolves four correctness checks **in parallel**, one subagent per check:

- `replay-minimum-duration-set`
- `replay-mask-config`
- `replay-disabled-in-test-envs`
- `replay-strict-minimum-duration`

## Status

Emit before dispatching:

```
[STATUS] Auditing session replay correctness
```

## Action — dispatch four subagents in one message

Make **four `Task` tool calls in a single message** so they run concurrently. Wait for all four to return, then continue to `3-session-replay-optimize.md`. Do not run any other tools between dispatch and the next step.

The bundled `how-to-control-which-sessions-you-record.md` reference holds PostHog's authoritative guidance on minimum duration, strict mode, sampling, and triggers. It's typically at `.claude/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`. Each subagent reads it once before judging.

### Task A — `replay-minimum-duration-set`

`description`: `Audit replay-minimum-duration-set`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-minimum-duration-set.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`). Focus on the "Minimum duration" section — without a minimum, every bounce session is recorded, inflating ingestion and storage costs while producing recordings that are too short to be useful.

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

### Task B — `replay-mask-config`

`description`: `Audit replay-mask-config`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-mask-config.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`). The default in posthog-js is `maskAllInputs: true`, which masks every `<input>` value. Explicitly setting `maskAllInputs: false` on a project that handles PII (forms, signup, payment, account) is a privacy / compliance risk.

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

### Task C — `replay-disabled-in-test-envs`

`description`: `Audit replay-disabled-in-test-envs`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-disabled-in-test-envs.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`). Test and CI runs that don't disable session replay flood the recording pipeline with synthetic, useless sessions that consume your replay quota.

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

### Task D — `replay-strict-minimum-duration`

`description`: `Audit replay-strict-minimum-duration`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: replay-strict-minimum-duration.

Read this skill's bundled `how-to-control-which-sessions-you-record.md` reference once (typically `.claude/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`; otherwise discover with `Glob` `**/skills/audit-session-replay/references/how-to-control-which-sessions-you-record.md`). Focus on the "Strict mode" section: in `strictMinimumDuration: true` mode, minimum duration is checked against actual buffered continuous data, not session age. This better filters short bouncing sessions across page refreshes. It's currently opt-in and likely to become the default in a future SDK release.

Run **one** Grep: `strictMinimumDuration|strict_minimum_duration`. Also re-grep `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` to locate init files.

Read each file that contains an init hit, once. Determine whether `strictMinimumDuration: true` is set inside the `session_recording` config.

Rule:
- pass: `strictMinimumDuration: true` is explicitly set on every init that enables session replay.
- suggestion: replay is enabled but `strictMinimumDuration` is unset or `false` — recommend opting into strict mode now to filter bounces more accurately and future-proof against the upcoming default.
- pass with details: "skip: replay explicitly disabled" — if every init disables replay.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `replay-strict-minimum-duration`, including `file` (path:line of the init or existing strictMinimumDuration site) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

## After all four return

Continue to **`3-session-replay-optimize.md`**.
