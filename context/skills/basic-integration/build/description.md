# Install and build

Install the declared dependencies, then verify the project builds. Be quick and
decisive — this step must not spiral.

## Install

Detect the package manager from the project's lockfile and run its install once,
in this project directory. The manifest already declares PostHog. If install is
slow, errors, or can't resolve a package, do not retry with offline flags and do
not poke the package manager's global store or cache — a failed install is a
conflict to report (below), not a problem to fight.

## Build and verify

Run the project's build (or typecheck), lint, and test scripts if they exist
(check the manifest's scripts). Only errors in the files this integration changed
are yours to fix — a missing import, a wrong call shape.
An error in a file the integration never touched is pre-existing: note it and
move on (below). Do not re-run build, typecheck, or lint hoping a pre-existing
failure clears — it will not, and each re-run is slow.

## Flag out-of-scope conflicts and move on

Work only inside this project's own directory. Never read, search, or write
anywhere outside it — not other repos, not the OS, not the package manager's
global store or cache.

A build or install you can't cleanly finish is a perfectly acceptable outcome —
**as long as you report it.** If you hit a conflict that is excessively difficult
or outside the scope of this integration — a dependency clash, a pre-existing
build break, an install that won't resolve, an environment issue unrelated to the
PostHog code — stop fighting it: put a one-line summary in your handoff `conflict`
field and the full detail in `did`, then complete the task. The user sees it in
the outro and the report; reporting it and moving on is the right outcome.
