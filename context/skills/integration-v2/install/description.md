# Install the PostHog SDK

Install PostHog with the project's own package manager so the real published version
is written to the manifest and the lockfile. Run the add command with the bare
package name and let the manager resolve the version — never type a version number
yourself; a version that was never published fails the run with `ETARGET`.

Match the manager the project already uses (read the lockfile: `package-lock.json` →
npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun; `poetry.lock` →
poetry, else pip; `composer.lock` → composer; `Gemfile.lock` → bundle). Add the
client library, plus the server library if the app sends events server-side.

If the repo has manifests for more than one ecosystem (a JS frontend alongside a
Python/PHP/Ruby backend, say), match the manifest for the language this task's
framework reference targets, not whichever manifest an automatic detector defaults
to for the whole repo.

Read the manifest first. If the SDK is already installed, leave it and say so.

Explicit-pin ecosystems (Swift SPM, Gradle) have no install command that resolves a
version — declare the dependency as the framework reference shows, taking the version
from the SDK's latest release.

Run the install once. Fix and retry only a mistake you own (wrong package or manager).
If the environment blocks it — no registry, a pre-existing broken lockfile, a peer
conflict already in the project — do not spiral: report the exact failure and command
in your handoff and finish.

## Reference

{references}
