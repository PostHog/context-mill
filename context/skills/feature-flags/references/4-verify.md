---
next_step: 5-report.md
title: Verify code, evaluation, and ingestion
description: Test the application and distinguish local checks from live PostHog evidence
---

# Step 4 - Verify code, evaluation, and ingestion

## Status

Emit:

```text
[STATUS] Verifying the feature flag implementation
```

## Verify the code

Review the final diff for unrelated changes, hardcoded secrets, empty or placeholder PostHog configuration, framework-unsupported configuration patterns, duplicate flag keys, unsafe defaults, and PII in event properties. For network-backed actions, confirm that failed requests cannot update successful UI state or emit success events.

Run the repository's focused tests, type checker, linter, and standard production build when those commands exist. A type check is not a substitute for the production build. If a command cannot run, record the exact blocker rather than silently omitting it.

Test both the control and flagged paths with the project's normal test doubles or an SDK-supported local override. Never commit an override. Source inspection may show that a path appears correct, but it does not count as executing that path.

## Verify PostHog state

Read the flag from PostHog again and confirm that its key, project, type, evaluation context, active state, and release conditions still match the plan.

When the application can run locally and safe test targeting is available, perform a runtime smoke test and exercise both flag states. Prefer an SDK-supported local override or a verified developer-only condition that cannot affect other users.

Before changing any PostHog-side flag state for testing, record its exact active state and release conditions and get the user's permission. After testing, restore the exact prior state, read the flag back, and retain the restoration evidence for the report. If restoration fails, stop changing the flag and report the mismatch as unresolved. Do not broaden or alter a shared rollout solely for testing without permission, and do not leave temporary conditions behind unless the user explicitly asks to keep them.

If one or both paths cannot be exercised safely, mark them as not run and state the exact manual step that remains.

Trigger one real evaluation from the running application. Query PostHog for the corresponding feature flag evaluation event and any custom action event added in Step 3. Confirm the event came from the expected environment and contains no PII.

A local flag value, browser console output, network request, or queued event proves only that the application attempted the operation. It does not prove server ingestion. Record live PostHog query results separately.

## Classify incomplete verification

Do not claim a verification layer passed when it could not run:

- A pre-existing build or test failure is a project baseline failure; include the command and error.
- Missing deployment configuration is pending deployment work, even when local evaluation passes.
- Missing MCP access or OAuth scope is pending PostHog verification.
- No observed live evaluation means ingestion is unverified, even when code checks pass.
- A path inferred from source code is source-reviewed, not runtime-verified.

Continue to the report with the evidence available. The report must make incomplete layers visible.

## Completion gate

Before continuing to the report:

1. Inspect the project scripts and list the applicable verification commands.
2. Run each applicable focused test, type check, lint, and standard production build.
3. If a defined command cannot run, classify it as `blocked` with the command and exact reason.
4. If verification changed PostHog-side flag state, restore it and confirm the restored state with a read-back.

Do not continue to Step 5 while a defined production build is still classified as `not run` or temporary flag-state restoration is unverified.
