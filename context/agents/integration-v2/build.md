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
then verify the project builds, typechecks, and lints — whichever of those the
project defines. Do not run the test suite; the runtime does not allow it, and a
green build is the bar here. Until now the steps only edited code and the manifest —
this is where it installs and gets checked.

Making the project run is the whole job. A separate review step reads the changes
after you, with fresh eyes and the best-practices skill; judging the work you just
installed is its job, not yours.

An earlier step wrote the dependency into the manifest but did not install it, so a
bad version only surfaces now. If the install fails because a declared version does
not exist (npm `ETARGET`, "no matching version", a yanked release), that is yours to
fix, not to fail on: you hold Edit and Bash. Correct the manifest to a real
published version — match the framework reference example's spec, or drop to a
caret range that resolves — and install again. Only report `failed` when the install
or build cannot be made to pass by fixing the integration's own changes.

## How you know you succeeded

The install completes and the project builds, typechecks, and lints as well as it
did before the run. If the build or lint fails only on pre-existing errors you did
not introduce, that still counts as done — note the conflict and finish. Reserve a failed status for when your own
changes break the build. Put a one-line summary of any conflict in your handoff's
`conflict` field and the full detail in what you did; the user sees the one-liner
in the outro and the detail in the report.
