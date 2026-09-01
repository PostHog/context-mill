---
type: wire-ci
flow: error-tracking
label: Set up CI for automatic uploads
model_pi: openai/gpt-5.6-sol
effort_pi: high
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: []
allowedTools: [Read, Write, Edit, Glob, Grep, load_skill_menu, install_skill]
disallowedTools: [enqueue_task]
dependsOn: [configure, credentials]
---

## Goal

Make the credentials reach the production build wherever it actually runs, so
source maps upload on every deploy — not just on a local build. Install the
skill your task input names (`install_skill` with the `skillId`) and follow its
**"Set up CI for automatic uploads"** step — it owns tracing where the
production build runs and wiring the credentials through every layer, whatever
the CI provider.

The `configure` and `credentials` handoffs already name the build-config keys
and the exact environment-variable names in use — carry those same names into
the pipeline; do not invent new ones. Trace the deploy path by reading the
project's own files (CI workflows, Dockerfiles, deploy scripts) — never invent
config that is not there. You cannot create the CI secret that holds the API
key; reference it by name and carry that follow-up, plus any deploy path you
could not trace, into your handoff for the report.

## How you know you succeeded

The pipeline that runs the production build carries the upload credentials by
the same names the credentials task used, and every secret the user still has
to create is named in your handoff. Your handoff lists the CI files you changed
and every manual follow-up, so the report can hand them to the user.
