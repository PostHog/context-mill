# Install, build, and review

Install the declared dependencies, verify the project builds, then review the
whole integration. This is the last check before the report — it is where the
run either earns trust or loses it. Be quick and decisive; this step must not
spiral.

## Install

Detect the package manager from the project's lockfile and run its install once,
in this project directory. The manifest already declares PostHog. If install is
slow, errors, or can't resolve a package, do not retry with offline flags and do
not poke the package manager's global store or cache — a failed install is a
conflict to report (below), not a problem to fight.

## Build and verify

Run the project's build (or typecheck) and lint scripts if they exist
(check the manifest's scripts). Do not run the test suite — the runtime only
permits install, build, typecheck, lint, and format commands, so a test command
is blocked; a build that compiles is sufficient verification. Only errors in the
files this integration changed are yours to fix — a missing import, a wrong call shape.
An error in a file the integration never touched is pre-existing: note it and
move on (below). Do not re-run build, typecheck, or lint hoping a pre-existing
failure clears — it will not, and each re-run is slow.

## Review the integration

Before you finish, review everything the earlier steps changed — the queue log's
handoffs name the files each one touched. This catches the things users complain
about most:

- **It builds.** A clean build or typecheck is the goal. If it fails, say so
  plainly in the handoff `conflict` — the exact failing command and why — and, if
  the failure is pre-existing, that the integration did not cause it. A silent or
  vague build failure is the worst outcome; a clearly-reported one is fine.
- **It matches the codebase.** The added PostHog code must read like the code
  around it — import style, naming, quotes, indentation, and the framework's
  idioms. Fix anything that looks foreign to the file it lives in.
- **Nothing was mangled.** Confirm each touched file still has its original code
  intact next to the PostHog additions, and that no file unrelated to the
  integration was edited. If a step deleted or rewrote code it shouldn't have, or
  reformatted an untouched region, restore it. Flag anything you can't safely fix
  in `conflict`.

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

Complete this task with status **done** whenever the integration itself is in
place — even if the build or typecheck still fails on pre-existing errors in files
you never touched. Note the pre-existing failure in `conflict` and move on. Only
use status **failed** when your own integration changes are what break the build
and you cannot resolve them. A `failed` status stops later steps that depend on
this one (the dashboard and report), so do not fail the task over breakage the
integration did not cause.
