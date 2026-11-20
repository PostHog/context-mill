# PostHog SDK {display_name} (existing major)

This skill supports {supported_versions}. The bundled reference is written for the newest of them, **{display_name}**. The project already has one of these majors installed. **Stay on the installed major**, reuse its existing PostHog client/initialization, and never raise the dependency across a major version or construct a duplicate client.

## Projects on a lower major than the reference

If the installed major is lower than the reference's ({display_name}), signatures can differ. Before writing a call, read the installed package's own source or types (`site-packages/posthog`, `node_modules/posthog-node`, the module cache for Go, the vendored crate for Rust) and match what is installed. When a feature's minimum version is above the installed major, use the fallback or report the minimum version. Do not upgrade to reach it.

## Reading bundled product docs on this major

Bundled product docs and `EXAMPLE.md` target the latest SDK major. Follow them for **high-level procedures and file placement only**. Verify every import path, option name, and method signature against this skill before editing.

If an installed package is below a feature minimum listed below:
- **Range constraint (`^`, `~=`, `>=M,<M+1`)**: bump the floor **within the installed major only** (`<M+1`) so dependencies resolve inside that major. A feature whose minimum is in a higher major is not reachable this way: use the fallback or report the minimum.
- **Exact hard pin (`==X.Y.Z` in Python, `"X.Y.Z"` in `package.json`, `"=X.Y.Z"` in `Cargo.toml`)**: keep the pin intact. Use a valid fallback for the installed major when available (e.g. manual `captureException` / `capture_exception`), otherwise skip that step and report the exact minimum version required.

## Guidelines & version bounds

{commandments}

## Breaking-change watchlist (when reading latest-major docs)

Whenever your task touches anything on this checklist, spot-search `references/migration.md` and the {display_name} reference below before writing code:

{migration_checklist}

## Bounded reference lookup

The bundled SDK reference and migration docs are too large for whole-file reads. **Never** read `references/*.md` without `offset` and `limit`.

1. Search `references/` for `^##`, `^###`, or exact symbol names with `Grep` first.
2. Read only the relevant 25–40 line window with `Read(offset, limit)`.
3. Inspect installed types in `node_modules` or `.venv` when present.

## Reference files

{references}
