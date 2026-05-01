# Step 1 — SDK installed + SDK up-to-date

This step is intentionally narrow. It runs **before any other project work**. Resolve exactly two checks: `sdk-installed` and `sdk-up-to-date`. **Do not** read source code, locate init sites, look at `.env*` files, or scan for identify/capture call sites in this step — that all belongs to later steps.

## Status

Emit:

```
[STATUS] Scanning manifests
[STATUS] Checking SDK version
```

## Action

### a. Find the PostHog SDK

`Glob` for the project's dependency manifests across every language PostHog ships an SDK for. The full list:

- `package.json` — npm / pnpm / yarn (Node, web, React, Next.js, Nuxt, Vue, Svelte, Angular, React Native, Expo)
- `requirements.txt`, `pyproject.toml`, `Pipfile`, `setup.py` — Python (Django, Flask, FastAPI, etc.)
- `Gemfile` — Ruby / Ruby on Rails
- `composer.json` — PHP / Laravel
- `go.mod` — Go
- `build.gradle`, `build.gradle.kts`, `pom.xml` — Java / Android
- `Podfile`, `Package.swift` — iOS / Swift
- `pubspec.yaml` — Flutter / Dart
- `*.csproj` — .NET
- `mix.exs` — Elixir

Read enough of them to identify which PostHog SDK the project uses, what version, and what framework it sits on top of.

If no PostHog SDK is anywhere in the project, emit `[ABORT] No PostHog SDK found` and stop. The wizard catches `[ABORT]` and terminates the run.

### b. Install the matching integration skill

Once you know the SDK + framework, install the matching integration skill so the rest of the audit has framework-specific install docs to reference instead of guessing:

1. Call `mcp__wizard-tools__load_skill_menu({ category: "integration" })` once to list available integration skill IDs.
2. Call `mcp__wizard-tools__install_skill({ skillId: "<id>" })` with the **single** ID that matches the framework you detected. Pick one — do not install multiple.

If no integration skill matches the framework, skip this step. Step 2 will fall back to general framework knowledge.

### c. Check latest published version

For each detected SDK, run `Bash` once to look up the latest published version. Use the command that matches the SDK's registry:

- **npm** (JS/TS, Node, React, Next.js, Nuxt, Vue, Svelte, Angular, React Native, Expo): `npm view <pkg> version`
- **PyPI** (Python): `pip index versions <pkg>` (or `pip show <pkg>` if `index` is unavailable)
- **RubyGems** (Ruby / Rails): `gem search ^<pkg>$ -r`
- **Packagist** (PHP / Laravel): `composer show <pkg> --latest --available --format=json`
- **Go modules** (Go): `curl -s https://proxy.golang.org/<module>/@latest` (returns JSON with the latest `Version`)
- **Maven Central** (Java / Android): `curl -s "https://search.maven.org/solrsearch/select?q=g:<group>+AND+a:<artifact>&rows=1&wt=json"` and read `.response.docs[0].latestVersion`
- **CocoaPods** (iOS / Swift): `pod search <pkg>` (or check `https://cdn.cocoapods.org/all_pods_versions_<x>_<y>_<z>.txt` for the spec mirror)
- **Swift Package Manager** (Swift): `gh release list --repo posthog/posthog-ios --limit 1` (SwiftPM resolves from GitHub tags)
- **pub.dev** (Flutter / Dart): `curl -s https://pub.dev/api/packages/<pkg> | jq -r .latest.version`
- **NuGet** (.NET): `curl -s https://api.nuget.org/v3-flatcontainer/<pkg>/index.json | jq -r '.versions[-1]'`
- **Hex** (Elixir): `mix hex.info <pkg>`

## Resolution rules

`sdk-installed`:
- `pass`: at least one PostHog SDK in a manifest. Record SDK + version in `details`.

`sdk-up-to-date`:
- `pass`: at the latest minor.
- `suggestion`: patch-only behind.
- `warning`: more than one minor behind.
- `error`: one or more major versions behind.

## Resolve

Single call to `mcp__wizard-tools__audit_resolve_checks` with two updates and **nothing else**:

```
{
  "updates": [
    { "id": "sdk-installed",  "status": "pass",                          "details": "<sdk>@<version>" },
    { "id": "sdk-up-to-date", "status": "pass|suggestion|warning|error", "details": "installed <v>, latest <v>" }
  ]
}
```

Do not include `init-correct` in this call — it's resolved in Step 2.
