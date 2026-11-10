# Install the PostHog SDK

Install PostHog with the project's own package manager so a real published version
is written to the manifest and the lockfile. Take the install command from the
reference docs below and keep the version or range it carries: the docs pin the
major the rest of the references cover. Never type a version the docs don't show; a version that was never published fails the run with
`ETARGET`. Take versions from the docs, not from the example app's manifest. If the
docs show no version, use the bare package name and let the manager resolve it.

The wizard refuses any `<` or `>` in a shell command, even inside quotes. When the
docs' version contains one (a Python range, a Ruby `~>`), write it
into the manifest (`requirements.txt`, `pyproject.toml`, `Gemfile`) and run the
manifest install (`pip install -r requirements.txt`, `bundle install`).

{{> sdk-majors}}

Match the manager the project already uses (read the lockfile: `package-lock.json` →
npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun; `poetry.lock` →
poetry, else pip; `composer.lock` → composer; `Gemfile.lock` → bundle). Add the
client library, plus the server library if the app sends events server-side.

Read the manifest first. If the SDK is already installed, leave it and say so.

Explicit-pin ecosystems (Swift SPM, Gradle) have no install command that resolves a
version — declare the dependency as the framework reference shows, with the version
the docs show. Do not look up the SDK's latest release for it.

Run the install once. Fix and retry only a mistake you own (wrong package or manager).
If the environment blocks it — no registry, a pre-existing broken lockfile, a peer
conflict already in the project — do not spiral: report the exact failure and command
in your handoff and finish.

## Reference

{references}
