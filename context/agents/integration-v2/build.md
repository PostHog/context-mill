---
type: build
flow: integration-v2
label: Build and review the integration
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

Bring the integration together and review it: install the dependencies the earlier
steps declared, verify the project builds and lints, then review every change for
convention fit and unintended edits. Until now the steps only edited code and the
manifest — this is where it installs, is checked, and is reviewed as a whole.

## How you know you succeeded

The install completes, the integration is in place, and the changes read like the
rest of the codebase with nothing unrelated touched or mangled. If the build or
lint fails only on pre-existing errors you did not introduce, that still counts as
done — note the conflict and finish. Reserve a failed status for when your own
changes break the build. Put a one-line summary of any conflict in your handoff's
`conflict` field and the full detail in what you did; the user sees the one-liner
in the outro and the detail in the report.
