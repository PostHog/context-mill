---
title: Plan the side-car files
next_step: 4-core.md
---

# Step 3, plan the side-car files

## Status

```
[STATUS] Reading <vendor> side-car reference
[STATUS] Writing side-car plan
```

## Read the vendor reference

Read `references/vendor-<vendor>.md` in full. It names the plugin file, where to register it, and the calls that have no PostHog equivalent.

## Choose file locations

- **Core module:** `posthog-sidecar.ts` (or `.js` in a JavaScript project) in the folder that already holds the vendor's init, or the project's shared `lib`/`utils` folder. It must be importable from browser code.
- **Plugin module:** `posthog-sidecar-<vendor>.ts` next to the core module.
- **Registration site:** the line right after the vendor's init call found in Step 1. If init happens in more than one place, register after each one. The plugin's install function is idempotent.

## Find unsupported calls

Search the project for the vendor calls that the vendor reference lists under "No PostHog equivalent". Record each one: these calls stay vendor-only, and the report lists them.

## Write the plan file

Write `.posthog-sidecar-plan.md` at the project root.

```
# Side-car plan

vendor: <vendor>
other vendors found: <list, or none>
vendor init: <file>:<line>
core module: <path>
plugin module: <path>
registration: <file>:<line>

- [x] detect — pass — <call-site count> <vendor> calls
- [x] install — <pass|warning|error> — <installed or already present; init file; options changed>
- [x] plan — pass
- [ ] core
- [ ] plugin
- [ ] verify

## Unsupported calls

| file | line | call | why |
|------|------|------|-----|
```

Leave the unsupported table empty if there are none.

Do not edit project source in this step.

Continue to `4-core.md`.
