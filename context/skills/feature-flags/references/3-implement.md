---
next_step: 4-verify.md
title: Implement the flagged behavior
description: Add a minimal framework-correct flag check with a safe control path
---

# Step 3 - Implement the flagged behavior

## Status

Emit:

```text
[STATUS] Implementing the feature-flagged behavior
```

## Choose the evaluation location

Use the framework reference and `COMMANDMENTS.md` to choose the evaluation location:

- Evaluate on the server when the flag affects the initial render, uses server-owned data, or protects backend execution.
- Evaluate on the client for interactions that only exist after the page has loaded.
- Pass a server result to the client when this avoids flicker or hydration differences.

Resolve the stable person or group identity before evaluating targeted flags. Do not invent a distinct ID. Preserve anonymous evaluation when the application has no authenticated identity.

## Implement the control and flagged paths

Read each file immediately before editing it. Keep the changes close to the existing behavior and avoid unrelated refactors.

- Preserve the current experience as the control path unless the user requested a different default.
- Handle the SDK's unevaluated or loading value explicitly. Do not treat `undefined`, `nil`, or an SDK error as proof that the flag is false.
- Evaluate the flag once at the smallest useful boundary instead of scattering repeated checks through the codebase.
- Keep the application working when PostHog configuration is absent, following `COMMANDMENTS.md`.
- Do not add a committed test override or development backdoor.
- When an action depends on one or more network requests, check every response or SDK result before changing local success state or capturing a success event. A rejected request, non-2xx response, or SDK error must follow the application's existing failure path.

Add or update focused tests for both the control and flagged paths when the project has a suitable test setup.

## Instrument meaningful behavior

PostHog SDKs can emit their own feature flag evaluation event. Do not manually duplicate that event.

Add a custom event only when the flagged experience contains a meaningful user action worth measuring. Capture the action in its event handler or backend operation, use the SDK's documented flag context mechanism when available, and keep event properties free of PII and user-generated content.
