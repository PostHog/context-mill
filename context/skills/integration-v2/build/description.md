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

Before building, re-read the framework rules you were given and check each one
that applies to this project against the diff you are about to verify. A rule
naming a file or a wiring this project has, with nothing in the diff answering
it, is unfinished work — do it now. This is the last step that can catch it.

Run the project's build (or typecheck) and lint scripts if they exist
(check the manifest's scripts). Where the toolchain ships its own analyzer rather
than manifest scripts, run that instead — it is the only thing that will catch a
lint the project itself enforces. Do not run the test suite — the runtime only
permits install, build, typecheck, lint, and format commands, so a test command
is blocked; a build that compiles is sufficient verification. Only errors in the
files this integration changed are yours to fix — a missing import, a wrong call shape.
An error in a file the integration never touched is pre-existing: note it and
move on (below). Do not re-run build, typecheck, or lint hoping a pre-existing
failure clears — it will not, and each re-run is slow.

If the manifest defines none of build, typecheck, or lint — a start/dev-only
script is not a substitute — no verification step is required here; say so in
the handoff and move on. Do not run the app's start or dev script as a stand-in
check: it does not exit, and this step blocks it either way.

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
- **The CSP lets it run.** If any handoff touched a Content-Security-Policy —
  a meta tag or a server-sent header — verify it directive-by-directive; do
  not take the handoff's word that the policy is handled. Required:
  `script-src` allows the PostHog hosts (needed even when posthog-js is
  bundled — replay/surveys/toolbar lazy-load from the assets CDN),
  `connect-src` allows the API host (falls back to `default-src`, so a bare
  `default-src 'self'` blocks sending), and `worker-src blob:` if session
  replay is on. A partial CSP is the worst failure shape: events send, so the
  integration looks alive, while replay and surveys silently never load. Fix a
  missing directive; flag anything structural in `conflict`.

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
