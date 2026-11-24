# PostHog SDK {display_name}

This run targets **{display_name}**. Spot-search the bundled reference documentation below before writing PostHog calls.

## Version facts

This skill's `feature-minimums.md` reference, listed below, says which APIs this major has. Where a framework rule names a version, take the version from that file.

## On an existing install

When the project already declares this SDK, keep its major and any exact pin, and reuse its existing client. Never reinstall it by bare name or at the docs' version, even where a task's instructions say to install the latest release; raise an open range's floor within this major only when a feature needs it.

## Bounded reference lookup

Read `references/*/feature-minimums.md` in full right after this file — it is short. The bundled SDK reference page (`references/*.x.x.md` or `references/kmp.md`) is thousands of lines long. **Never** read that large reference file from start to finish in one call.

1. Search this skill's `references` directory (pass the directory path to `Grep`, never a `.md` file path) for `^##`, `^###`, or exact symbol names first.
2. Open only the matching slice with `Read` using `offset` and `limit` (25–40 lines).
3. Check installed package types in `node_modules` or `.venv` when present.

## Reference files

{references}
