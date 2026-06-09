# Install and build

Bring the integration together: install the declared dependencies, then verify the
project builds.

## Install

Detect the package manager from the lockfile — `pnpm-lock.yaml` → pnpm,
`yarn.lock` → yarn, `bun.lockb` → bun, otherwise npm — and run its install. The
manifest already declares PostHog from the install step; you are realizing it now.

## Build and verify

Run the project's build or typecheck script if one exists (check the manifest's
scripts for `build`, `typecheck`, `tsc`). Fix straightforward issues from the new
PostHog code — a missing import, a wrong call shape.

## Conflicts

If install or build surfaces a conflict you cannot cleanly resolve — a peer
dependency clash, a version conflict, a build error you should not paper over —
stop forcing it. Summarize it in one line in your handoff `conflict` field, and
put the full detail and what you tried in `did`. The user sees the one-liner in
the outro and the detail in the report.
