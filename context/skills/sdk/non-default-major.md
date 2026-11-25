# PostHog SDK {display_name} (existing major)

This skill supports {supported_versions}. {supported_versions_note} **Stay on the installed major**, reuse its existing PostHog client/initialization, and never raise the dependency across a major version or construct a duplicate client.

**This skill wins over the framework rules and product docs.** The framework rules, the bundled product docs, and your task instructions describe the latest SDK major. Where they name an API, integration, or version the installed SDK lacks, or tell you to install the docs' version, follow this skill and its `api-notes.md` reference instead. For example, a framework rule to register `PosthogFlaskIntegration` on posthog 7.40 becomes manual request context plus `capture_exception` in the app's error handlers.

## Projects on a lower major or minor than the reference

If the installed version (major or minor) is older than the reference ({reference_version}), signatures can differ, and the reference alone is not evidence for a call. Do these steps in order **before your first edit**:

1. **Find the installed package.** Take the exact version from the project's lockfile, then read the package source at that version:
   - **Python:** `site-packages/posthog` in the project's `.venv` or `venv`.
   - **Node:** `node_modules/posthog-node`.
   - **Go:** `vendor/github.com/posthog/posthog-go`, else `$(go env GOMODCACHE)/github.com/posthog/posthog-go[/v2]@<version from go.sum>`.
   - **Rust:** `vendor/`, else `~/.cargo/registry/src/*/posthog-rs-<version>` or `posthog-<version>`, with the version from `Cargo.lock`.
   - **iOS:** `Pods/PostHog` for CocoaPods; for Swift Package Manager, `SourcePackages/checkouts/posthog-ios` in the project's DerivedData, at the version in `Package.resolved`.
   - **Flutter:** the `posthog_flutter` `rootUri` in `.dart_tool/package_config.json` (a pub cache folder), at the version in `pubspec.lock`.
   - **Android and KMP:** the sources jar under `~/.gradle/caches/modules-2/files-2.1/com.posthog/<artifact>/<version>/`, with the version from `./gradlew dependencies`. If there is no sources jar, treat the package as not installed.

   Outside the project, read only that one package folder at that exact version. Never search other projects, other versions, or system-wide. If nothing is found, treat the package as not installed and go to step 3.
2. **If it is installed**, search its own source or types for every PostHog import, constructor, and method you are about to call. Verify both the exact receiver (client class method on `Client`/`Posthog` vs module-level export such as `from posthog import identify_context, new_context, tag`) and positional vs keyword parameter signatures, and write each call to match what is installed. Never assume a symbol is a method on the client class just because a search finds `def <name>` in the package or the newer reference shows `client.<name>`.
3. **If it is not installed**, copy the call shape from PostHog calls the project already makes. For a method the project does not call yet, use the reference, name that call as unverified in your report, and list every unverified PostHog call in your handoff's `assumptions` or `forNextAgent` field so the `review` step checks it against the installed package once dependencies are installed. Do not fail or skip a step because the package is missing. Once dependencies are installed later in the run, check those calls against the installed package and fix any that differ.

Never write a call from the reference alone while the installed package is there to check. When the installed version lacks an API, use the fallback in `api-notes.md`. Never change the declared PostHog SDK version to reach an API: the wizard already checked that this version supports the task's product.

## Reading bundled product docs on this major

Bundled product docs and `EXAMPLE.md` target the latest SDK major. Follow them for the implementation pattern: high-level procedures, file placement, and where to capture events and exceptions, including inside the app's existing error handlers. Don't copy their exact APIs. Verify every import path, option name, and method signature against the installed package (steps 1–3 above) before editing. Use this skill's reference only for calls you cannot check there.

Where a framework rule or doc names an API newer than the installed version, use the fallback this skill's `api-notes.md` reference gives for it.

## On an existing install

These rules hold for every task in the run, including install and review steps whose instructions say to leave an installed SDK alone, install the latest release, or reinstall a package by bare name:

- **Keep the major and its pins.** Leave the declared version and any exact pin in place, and reuse the existing client, even where a product skill says to raise them. Use the fallback instead. Never reinstall the PostHog SDK the project already declares by bare name or at the docs' version, and never change its declaration.
- **Use the call shape of the installed major.** Write each PostHog call the way the installed package defines it (steps 1–3 above), not the way the latest docs show it. `api-notes.md` lists the call shapes that changed between majors.
- **Fall back when an integration is missing.** When the installed version is below a framework integration's minimum, wire manual request context and manual `capture_exception` / `captureException` in the app's existing error handlers instead, and say so in your handoff.
- **Prefer module-level helpers.** Where the installed SDK exposes context helpers at module level (for example `from posthog import new_context, identify_context`), import them from there; not every version has them as client methods.
- **Keep `identify()` where it still exists.** On a major that still has `identify()`, keep the project's existing `identify()` calls for person properties instead of rewriting them to newer APIs.
- **Keep the package name and import path.** Keep the Go module path and the Rust crate name of the installed major. `api-notes.md` lists them.
- **Check after install.** Once dependencies are installed, check every PostHog import, constructor, and call the run added against the installed package, and fix any that differ before the compile checks. This overrides instructions not to read the SDK's installed internals.

## Breaking-change watchlist (when reading latest-major docs)

Whenever your task touches anything on this checklist, spot-search `references/migration.md` or `references/*/migration.md` (when present) and the {reference_version} reference below before writing code:

{migration_checklist}

## Bounded reference lookup

Read `references/*/api-notes.md` in full right after this file — it is short and lists each API's minimum and fallback. The bundled SDK reference (`references/*.x.x.md` or `references/kmp.md`) and `references/migration.md` (or `references/*/migration.md`) are too large for whole-file reads. **Never** read those large reference or migration files without `offset` and `limit`.

1. Search this skill's `references` directory (pass the directory path to `Grep`, never a `.md` file path) for `^##`, `^###`, or exact symbol names first.
2. Read only the relevant 25–40 line window with `Read(offset, limit)`.
3. Inspect the installed package from step 1 when present.

## Reference files

{references}
