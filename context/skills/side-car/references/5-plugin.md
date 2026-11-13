---
title: Write and register the vendor plugin
next_step: 6-verify.md
---

# Step 5, write the vendor plugin and register it

## Status

```
[STATUS] Writing <vendor> side-car plugin
[STATUS] Registering side-car after <vendor> init
```

## Write the plugin

Open `references/vendor-<vendor>.md` and write its canonical plugin to the plugin module path from the plan file. Adapt only these:

- the import path of the core module;
- the import of the vendor SDK, to match how the project imports it (for example a local wrapper that re-exports the instance, or `window.<global>` for a snippet install);
- types, for a JavaScript project.

Keep every `try`/`catch`, every "return the payload unchanged" line and every skip list. They are what keep the vendor safe.

## Register it

At each registration site from the plan, import the plugin module's install function and call it right after the vendor's init call. Follow the "Register" section of the vendor reference.

Only add the import and the one install call. Do not touch vendor call sites.

## Update the plan file

Tick the `plugin` line: `- [x] plugin — pass — <plugin path>; registered at <file>:<line>`. Use `warning` if the vendor reference's fallback was needed, and say why.

Continue to `6-verify.md`.
