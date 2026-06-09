---
type: build
label: Install dependencies and build
model: claude-sonnet-4-6
skills: [build]
allowedTools: [Read, Edit, Glob, Grep, Bash]
disallowedTools: [enqueue_task]
dependsOn: [install, init, identify, error-tracking, capture]
---

## Goal

Bring the integration together: install the dependencies the earlier steps
declared, then verify the project builds, lints, and passes its tests. Until now
the steps only edited code and the manifest — this is where it actually installs
and is checked.

## How you know you succeeded

The install completes and the build, lint, and tests pass. If you hit a conflict
you cannot cleanly resolve — a dependency clash, a build error from the new code —
fix what you safely can, then report it: put a one-line summary in your handoff's
`conflict` field and the full detail in what you did. The user sees the one-liner
in the outro and the detail in the report.
