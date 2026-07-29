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
- If the key does not exist, create one boolean flag with a useful description and an evaluation context that matches where the code will evaluate it.

Do not silently modify an existing flag's conditions, rollout percentage, active state, variants, payload, or evaluation context.

## Use conservative release conditions

For a new flag, preserve the control experience by default. Prefer an inactive flag, a zero-percent rollout, or a verified developer-only condition until the user has chosen a rollout audience. Do not create a broad rollout merely to simplify testing.

If the available tool cannot create the flag with safe conditions, ask the user before using its defaults.

## MCP fallback

If PostHog MCP is unavailable, authentication fails, or the required feature flag scope is missing, give the user the flag key, description, type, evaluation context, and conservative rollout settings to create in the PostHog dashboard. Wait for confirmation before changing application code.

When running without an interactive user, emit:

```text
[ABORT] PostHog feature flag access is required. Connect PostHog MCP or create the proposed flag in PostHog, then rerun the command.
```

After creating or reusing a flag through MCP, read it back and confirm the exact key, type, project, active state, evaluation context, and release conditions. Keep this evidence for the final report.
