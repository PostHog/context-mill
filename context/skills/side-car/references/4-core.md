---
title: Write the side-car core
next_step: 5-plugin.md
---

# Step 4, write the side-car core module

## Status

```
[STATUS] Writing side-car core
```

## Write the module

Read `references/sidecar-core.md`. Write its code block to the core module path from the plan file, without changes except these:

- In a JavaScript project, remove the type annotations.
- If the project imports posthog-js from a local wrapper module instead of `posthog-js`, import from that module.
- Match the project's formatting (quotes, semicolons, indentation).

Do not add vendor-specific logic to the core. Vendor logic belongs in the plugin module.

## Update the plan file

Tick the `core` line: `- [x] core — pass — <path>`.

Continue to `5-plugin.md`.
