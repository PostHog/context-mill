# Install and build

Install the declared dependencies, then verify the project builds. Be quick and
decisive — this step must not spiral.

## Install

Detect the package manager from the project's lockfile and run its install once,
in this project directory. The manifest already declares PostHog.

## Build and verify

Run the project's build (or typecheck), lint, and test scripts if they exist
(check the manifest's scripts). Fix only obvious issues from the new PostHog code —
a missing import, a wrong call shape.

## Flag out-of-scope conflicts and move on

Work only within this project's own directory; other repos and directories are not
part of this task.

If you hit a conflict that is excessively difficult and outside the scope of this
integration — a dependency clash, a pre-existing build break, an environment issue
that is not about the PostHog code — flag it and move on rather than spend time
fighting it. Put a one-line summary in your handoff `conflict` field and the full
detail in `did`, then complete the task. The user sees it in the outro and the
report; flagging it is the right outcome.
