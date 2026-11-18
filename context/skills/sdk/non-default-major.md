# PostHog SDK {display_name} (existing major)

This project already has **{display_name}** installed. **Stay on major {display_name}**, reuse its existing PostHog client/initialization, and do not upgrade across major versions or construct a duplicate client.

## Reading bundled product docs on this major

Bundled product docs and `EXAMPLE.md` target the latest SDK major. Follow them for **high-level procedures and file placement only**. Verify every import path, option name, and method signature against this skill before editing.

If an installed package is below a feature minimum listed below:
- **Range constraint (`^`, `~=`, `>=M,<M+1`)**: bump the floor **within this major only** (`<M+1`) so dependencies resolve inside {display_name}.
- **Exact hard pin (`==X.Y.Z` in Python, `"X.Y.Z"` in `package.json`, `"=X.Y.Z"` in `Cargo.toml`)**: keep the pin intact. Use a valid {display_name} fallback when available (e.g. manual `captureException` / `capture_exception`), otherwise skip that step and report the exact minimum version required.

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
