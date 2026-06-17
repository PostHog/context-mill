---
title: Confirm source-SDK presence
next_step: 2-install-posthog.md
---

# Step 1, confirm the source SDK is present

Discovery only. Do not modify project files. Do not write the plan file, Step 3 owns that.

## Procedure

Read `references/sdk-reference.md` to learn the source SDK's package names, import shapes, and call patterns. That file is the only source of truth for what the source SDK looks like.

Once you know the SDK's name, emit `[STATUS] Scanning project for <SDK name> calls` (for example, `[STATUS] Scanning project for Statsig calls`). Use the SDK's real name, not "source SDK".

Then decide whether the source SDK is in this project. A robust signal combines its package in the project's manifest with at least one call site in source code. Compose your own searches using the patterns from the variant reference.

If you find nothing, do not invent alternative patterns and do not widen the search to other SDKs that happen to be present. Emit `[ABORT] No source-SDK calls found` and stop. That is the correct outcome, not a failure to work around.

If you find a match, continue to `2-install-posthog.md`.
