---
type: build
flow: posthog-integration
label: Install dependencies and build
model: openai/gpt-5.6-terra
skills: [posthog-integration-build]
allowedTools: [Read, Edit, Glob, Grep, Bash]
disallowedTools: [enqueue_task]
dependsOn: [install, init, identify, error-tracking, capture]
---

## Goal

Bring the integration together: install the dependencies the earlier steps
declared, then verify the project builds and lints. Until now
the steps only edited code and the manifest — this is where it actually installs
and is checked.

## How you know you succeeded

The install completes and the integration is in place. If the build or lint fails
only on pre-existing errors you did not introduce, that still counts as done —
note the conflict and finish. Reserve a failed status for when your own changes
break the build. Put a one-line summary of any conflict in your handoff's
`conflict` field and the full detail in what you did; the user sees the one-liner
in the outro and the detail in the report.
