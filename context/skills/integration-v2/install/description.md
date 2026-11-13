# Install the PostHog SDK

Install PostHog with the project's own package manager so the real published version
is written to the manifest and the lockfile. Open the library doc listed under
Reference below before you install. Run the add command it shows with the version it
pins, or the bare package name if it pins none, and let the manager resolve the rest —
never type a version the doc doesn't show; a version that was never published fails
the run with `ETARGET`. EXAMPLE.md shows code patterns only; never take a version
from its manifests.
If the wizard refuses that command, write the pin into the manifest and run the
manifest install.

Match the manager the project already uses (read the lockfile: `package-lock.json` →
npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun; `poetry.lock` →
poetry, else pip; `composer.lock` → composer; `Gemfile.lock` → bundle). Add the
client library, plus the server library if the app sends events server-side.

Read the manifest first.

Explicit-pin ecosystems (Swift SPM, Gradle) have no install command that resolves a
version — declare the dependency as the library doc shows, taking the version it pins.

Run the install once. Fix and retry only a mistake you own (wrong package or manager).
If the environment blocks it — no registry, a pre-existing broken lockfile, a peer
conflict already in the project — do not spiral: report the exact failure and command
in your handoff and finish.

## Reference

{references}
