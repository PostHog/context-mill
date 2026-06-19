---
next_step: 2-read-context.md
---

# Step 1 — Check access

Verify the Signals API is available for this project before touching anything. Self-driving is in beta and enabled per team by PostHog; there is no flag you can read, so the API itself is the probe.

## Status

Emit:

```
[STATUS] Checking Self-driving access
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__inbox-source-configs-list` (subsequent steps load their own tools).

## Do

1. Call `inbox-source-configs-list`.
2. **Success — including an empty list** — means the API is reachable: proceed. (The probe can't prove beta enrollment — the wizard's detect step and the beta flags own that — but it's the strongest signal available to you.) Keep the returned rows: step 2 and step 5 use them as the already-enabled baseline. Mark your access task completed and continue.
3. A permission error (403), not-found (404), or "scope" error means Self-driving is not available to this caller. Emit exactly:

   ```
   [ABORT] self-driving is not available for this project
   ```

   and stop — the wizard renders the explanation.

Do not retry the probe more than once; a transient network failure is worth one retry, an authorization error is not.

A 5xx error after a retry is also not access denial — abort is wrong there. Surface it as a plain error instead: report the failure and stop without the `[ABORT]` marker so the wizard treats it as an error, not a clean refusal.
