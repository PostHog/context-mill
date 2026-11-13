---
title: Verify the project still builds
next_step: 7-report.md
---

# Step 6, verify the project still builds

## Status

```
[STATUS] Linting files I edited
[STATUS] Running type check
[STATUS] Running build
```

Read the project's manifest for its lint, type check and build scripts. Run the linter only on the files you created or edited. Then run the type check and the build. Do not spawn subagents.

Fix only failures caused by the side-car or the PostHog init: a wrong import path, a type mismatch in the plugin, a missing package install. The vendor SDK's own types are in `node_modules` if you need them. When a vendor type does not match the canonical plugin, widen it with a local type or `unknown` cast. Do not change the plugin's behavior.

Do not fix pre-existing failures unrelated to your edits. Record them instead.

## Update the plan file

```
- [x] verify — pass — lint + typecheck + build clean
- [x] verify — error — <command that failed and a short excerpt>
```

Continue to `7-report.md` regardless of the outcome.
