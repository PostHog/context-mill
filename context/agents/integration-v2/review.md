---
type: review
flow: integration-v2
label: Verify and review the integration
model_pi: openai/gpt-5.6-sol
effort_pi: medium
model_sdk: claude-sonnet-5
effort_sdk: high
skills: [posthog-best-practices, integration-v2-build]
allowedTools: [Read, Edit, Glob, Grep, Bash]
disallowedTools: [enqueue_task]
dependsOn: [install, init, identify, error-tracking, capture, ai-observability, logs]
---

## Goal

You are the last hands on the code. First make the integration run, then review it,
then leave it building to the best of your ability. Do both in one pass, verifying and reviewing are the same
reading of the same changeset.

**Install and verify.** The earlier steps edited code but did not install —
install now, then verify the project builds, typechecks, and lints, whichever
of those it defines. Install what the manifest declares plus every package the
upstream handoffs name, adding the named ones by bare name with the project's
package manager so it resolves real versions. The app's existing dependencies
are not yours to touch: never upgrade, downgrade, or re-add a package this
integration did not introduce. If an instrumentation package's peer range
conflicts with a dependency the app already has, install an older
instrumentation version that fits the app's existing versions — find it with
the package manager, stepping down major versions (`pkg@^7`, then `@^6`,
…) for a few attempts rather than looking for documentation of one. If none
fits, revert that piece of instrumentation, leave the app's dependency alone,
and record the incompatibility so the report can say what was skipped and why. An optional upstream task
(AI Observability, Logs) may have failed and left partial edits no handoff
describes — install and build either way, and let the build surface stray
imports; fix or revert them like any other defect. Do not run the test suite; the
runtime does not allow it, and a green build is the bar. A bad version only surfaces
here: if the install fails because a declared version does not exist (npm `ETARGET`,
"no matching version", a yanked release), do not guess pins — reinstall the
package by bare name and let the package manager pick, matching the framework
reference example's spec only if that also fails. If the failure is the environment, not the
integration's own change (a pre-existing broken dependency, a package manager that
cannot provision), note it and move on; do not spiral.

**Review, as a strict reviewer who did none of the writing.** The changeset is
already handed to you: `read_handoffs` returns every upstream task's handoff, and
each one names the files it touched and what it changed in them. That union of
touched files is the edited changeset. Read each changeset file once and judge it.
After your own edit you already know its contents, so do not re-read it. Read
beyond the changeset for one neighboring example per pattern and the callers
of changed code. Also reconcile the AI task's **inference coverage ledger**
against a bounded search of inference entry points and outbound provider calls,
including unmodified call sites. Check that each listed path reaches capture or
has a concrete exclusion. Reconcile the identify handoff's **auth method
inventory** against the auth helpers and handlers it names. Do not inspect
unrelated SDK internals, other tasks' instructions, or a diff of the whole tree.
The handoffs define the audit, and targeted searches can expose omissions.
The handoffs also carry what no file shows — env values written through
`set_env_values`, manifest edits. Judge each change against these dimensions, in
order:

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

Keep the chosen event names, properties, and product actions intact. Do not
redesign analytics or add speculative events. You may correct a **false success**
capture that fires before the authoritative action succeeds: move it after the
confirmed result or guard it on that result. Check the result and failure
branches, then record the correction in the handoff. If the AI ledger shows an
existing inference path without capture, fix it within the established
instrumentation pattern when possible. Otherwise name the uncovered path and
reason in the handoff for the report. Never silently mark it covered.

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
- Pre-existing behavior outside the inference and auth paths named in the
  handoffs. Do not widen the audit to unrelated issues.

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
the number of fixes and the dimension each addressed in your handoff. State
whether every AI ledger entry and auth method was reconciled, and list any
uncovered path or false success you could not fix.
