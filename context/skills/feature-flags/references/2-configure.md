---
next_step: 3-implement.md
title: Find or create the PostHog feature flag
description: Reuse an exact flag or create one with conservative release conditions
---

# Step 2 - Find or create the PostHog feature flag

## Status

Emit:

```text
[STATUS] Checking the feature flag in PostHog
```

{{> mcp-tool-calling}}

## Select the project

Use the authenticated PostHog project selected by the invoking program. Confirm that its host and region match the application's existing non-secret configuration without reading the raw project token. Do not assume a region or project. If more than one project is available and the correct one cannot be established, ask the user to choose.

Never expose a personal API key, OAuth token, or other secret to the model, logs, or application source. Continue using the project's existing configuration names and values.

## Find before creating

Discover the available feature flag tools, inspect their schemas, and list or search flags before creating anything.

- If the exact key exists and its type is compatible, reuse it.
- If the exact key exists with incompatible variants, payloads, or evaluation context, explain the conflict and ask before changing either the plan or the flag.
- If the key does not exist, create one boolean flag with a useful description, an evaluation context that matches where the code will evaluate it, and an explicit zero-percent rollout. When the API represents "off" only through active state, create it inactive instead.

Do not silently modify an existing flag's conditions, rollout percentage, active state, variants, payload, or evaluation context.

## Use conservative release conditions

For a new flag, preserve the control experience by default. Pass an explicit zero-percent rollout in the creation call; never omit release conditions or rely on the tool's default. For PostHog API-shaped tools, set a release condition under `filters.groups` with `rollout_percentage: 0`. If a wrapper uses a different shape, inspect its schema and set the equivalent explicit field. Use an inactive flag only when that is how the API represents a fully off flag. Do not create a broad or developer-targeted rollout merely to simplify testing.

If the available tool cannot create the flag at zero percent or inactive, do not call it with unsafe defaults. Give the user the proposed flag configuration to create manually and wait for confirmation.

Read every newly created flag back immediately. Confirm that it is inactive or has a zero-percent rollout with no condition that can match a user. If the read-back is broader than requested, return it to zero percent or inactive before changing application code, then read it back again. If the safe state cannot be restored and confirmed, stop.

When reusing an existing flag that already reaches users, explain that adding new behavior behind it could expose that behavior immediately. Continue only after the user confirms that existing audience, or choose a new flag key with a zero-percent rollout. Never change an existing flag's rollout to make it fit the implementation.

## MCP fallback

If PostHog MCP is unavailable, authentication fails, or the required feature flag scope is missing, give the user the flag key, description, type, evaluation context, and conservative rollout settings to create in the PostHog dashboard. Wait for confirmation before changing application code.

When running without an interactive user, emit:

```text
[ABORT] PostHog feature flag access is required. Connect PostHog MCP or create the proposed flag in PostHog, then rerun the command.
```

After creating or reusing a flag through MCP, read it back and confirm the exact key, type, project, active state, evaluation context, and release conditions. Do not continue to application changes until the confirmed PostHog state matches the user's approved plan. Keep this evidence for the final report.
