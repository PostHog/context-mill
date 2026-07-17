---
type: build
flow: integration-v2
label: Build the integration
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-build]
allowedTools: [Read, Edit, Glob, Grep, Bash]
disallowedTools: [enqueue_task]
dependsOn: [install, init, identify, error-tracking, capture]
---

## Goal

Bring the integration together: install the dependencies the earlier steps declared,
then verify the project builds, lints, and passes its tests. Until now the steps only
edited code and the manifest — this is where it installs and gets checked.

Making the project run is the whole job. A separate review step reads the changes
after you, with fresh eyes and the best-practices skill; judging the work you just
installed is its job, not yours.

## How you know you succeeded

The install completes and the project builds, lints, and tests as well as it did
before the run. If the build or lint fails only on pre-existing errors you did not
introduce, that still counts as done — note the conflict and finish. Reserve a failed status for when your own
changes break the build. Put a one-line summary of any conflict in your handoff's
`conflict` field and the full detail in what you did; the user sees the one-liner
in the outro and the detail in the report.
