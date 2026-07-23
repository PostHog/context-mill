---
type: review
flow: integration-v2
label: Verify and review the integration
model_pi: openai/gpt-5.6-sol
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [posthog-best-practices, integration-v2-build]
allowedTools: [Read, Edit, Glob, Grep, Bash]
disallowedTools: [enqueue_task]
dependsOn: [install, init, identify, error-tracking, capture]
---

## Goal

You are the last hands on the code. First make the integration run, then review it,
then leave it building. Do both in one pass — verifying and reviewing are the same
reading of the same changeset.

**Install and verify.** The earlier steps edited code and declared the SDK in the
manifest but did not install it — install now, then verify the project builds,
typechecks, and lints, whichever of those it defines. Do not run the test suite; the
runtime does not allow it, and a green build is the bar. A bad version only surfaces
here: if the install fails because a declared version does not exist (npm `ETARGET`,
"no matching version", a yanked release), fix the manifest to a real published
version — match the framework reference example's spec, or a caret range that
resolves — and install again. If the failure is the environment, not the
integration's own change (a pre-existing broken dependency, a package manager that
cannot provision), note it and move on; do not spiral.

**Review, as a strict reviewer who did none of the writing.** Find the full changeset
yourself: grep for posthog (all cases) across source and config, read each file, and
read the handoffs for what grep cannot see (env files, manifest edits). Judge each
change against these dimensions, in order:

1. Minimal — every line earns its place. Delete helpers nothing calls, defensive
   wrapping around code that cannot fail, config for features that were not set up,
   and comments that narrate what a line does or that it was added.
2. Unrelated — the run must not have changed behavior outside the integration.
   Revert reformatting, renames, or edits in code the integration never needed.
3. Codebase patterns — for each kind of edit (client construction, how call sites
   reach it, config and env access, imports, naming, comment density), find one
   neighboring example in this project and compare. If a change invented a seam the
   project does not have — a registry, locator, wrapper, or app the codebase never
   uses — replace it with the closest pattern the project actually uses.
4. Example shapes — where the framework reference example shows a shape for init or
   instrumentation, the code should be recognizably that shape adapted to this
   codebase. Codebase idiom beats the example when they conflict; the PostHog
   correctness rules you were given beat both.

You never change what is captured — event names, properties, and where events fire
are a contract the dashboard and report are built on. Refactor how, and kill bad
changes; never alter the what.

Events reaching PostHog in production is the point of this code, so a capture wired
to a place it will never fire, an uninitialized SDK, or a call the runtime silently
drops is squarely yours to catch and fix — it is a code defect. What you cannot do is
confirm delivery: you cannot exercise the app, and you never treat "I could not
verify events arrive" as a finding.

Stay inside verify-and-review. These are not your job:

- The report or the dashboard — other tasks own those; do not write or judge them.
- Product or analytics design — which events are worth tracking, identity strategy,
  framework-version tradeoffs. The changeset is the decision; review whether the code
  implements it correctly, not whether it was the right decision.
- Anything the integration did not touch. Do not widen scope to pre-existing issues.

If you notice something real but out of scope, leave it — a one-line mention in your
handoff, no more. Only flag what you can pin to a specific line and dimension — no
taste-based rewrites, and never expand the integration. For each fix, ask what would
behave differently if it were wrong, and check by reading the callers. After any
change, re-run the build or lint and confirm it still passes.

## How you know you succeeded

The project installed and builds, typechecks, and lints as well as it did before the
run; you can name each review dimension and say it passes; and your fixes are in the
files. If the build or lint fails only on pre-existing errors you did not introduce,
that still counts — put a one-line summary in the `conflict` field and the detail in
what you did. Reserve a failed status for when your own changes break the build. Put
the number of fixes and the dimension each addressed in your handoff.
