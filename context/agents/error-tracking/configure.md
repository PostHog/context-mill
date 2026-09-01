---
type: configure
flow: error-tracking
label: Apply build-config changes
model_pi: openai/gpt-5.6-sol
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: []
allowedTools: [Read, Write, Edit, Glob, Grep, Bash, load_skill_menu, install_skill]
disallowedTools: [enqueue_task]
dependsOn: [capture-exceptions]
---

## Goal

Make this project's production build emit and upload source maps (or, for Go
and Rust, native debug symbols). Install the skill your task input names
(`install_skill` with the `skillId`) and read it — it is the source of truth
for the per-framework build-config and the uploader wiring.

Two of the skill's steps are yours:

- **"Apply build-config changes"** — make the bundler / build-config edits the
  skill instructs for this platform, so the build produces and injects the
  chunk IDs PostHog needs and runs the uploader.
- **"Make credentials available at build time"** — do the skill's step so the
  build can read the upload credentials from the environment. If it calls for a
  loader (e.g. `dotenv`), install it SILENTLY with the project's package
  manager. Skip this step entirely when the platform already auto-loads `.env`.

Do not write any credential values and do not create env files — the
`credentials` task owns that, in parallel with you. Do not run the build.

## How you know you succeeded

The build config carries the skill's source-map / debug-symbol changes and can
read its credentials from the environment at build time. Your handoff names
every file you changed and the exact build-config keys you added, so the CI
task can wire the same variables through the pipeline.
