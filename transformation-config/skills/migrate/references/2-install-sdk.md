---
title: Install PostHog SDK without initializing
next_step: 3-plan.md
---

# Step 2 — Install PostHog SDK (no init yet)

This step installs the PostHog SDK package matching the project's framework, but **does not** add any initialization code. Initialization is added during Step 4 alongside the migrated call sites, so it lands in the same place the source's init currently lives.

## Status

Emit:

```
[STATUS] Detecting project framework
[STATUS] Installing matching integration skill
[STATUS] Installing PostHog SDK package
```

## Action

### a. Detect the project framework

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

Read enough of them to identify the framework the project sits on top of (e.g. Next.js App Router, Django, FastAPI, Vue 3, etc.) and the package manager.

If no manifest matches a supported framework, emit `[ABORT] No project framework detected` and stop.

### b. Install the matching integration skill

Once you know the framework, install the matching PostHog integration skill so the rest of the migration has framework-specific install + init docs to reference instead of guessing:

1. Call `mcp__wizard-tools__load_skill_menu({ category: "integration" })` once to list available integration skill IDs.
2. Call `mcp__wizard-tools__install_skill({ skillId: "<id>" })` with the **single** ID that matches the framework you detected. Pick one — do not install multiple.

If no integration skill matches the framework, skip the install. The rest of the migration falls back to general framework knowledge — stay conservative.

### c. Detect the package manager

Call `mcp__wizard-tools__detect_package_manager` once. Use the returned install command for the next sub-step. For projects with multiple matches, pick the one whose lockfile is present.

### d. Install the PostHog SDK package — and only the package

Read the integration skill you installed in (b). It contains the canonical PostHog SDK package name for this framework (e.g. `posthog-js` + `posthog-node` for Next.js, `posthog` for Python, `posthog-ruby` for Rails, etc.).

Run the install command (`npm install <pkg>`, `pip install <pkg>`, `bundle add <pkg>`, etc.) using the package manager from (c). For frameworks where multiple PostHog packages ship together (e.g. Next.js needs both client and server), install all of them in this step.

**Do not write any init code.** Do not create a `posthog.ts` / `instrumentation.ts` / equivalent init file. Do not call `posthog.init` anywhere. Do not edit existing source files in this step. The SDK package goes into the manifest only.

After the install command completes, run a build / typecheck only if the package manager already ships one as a postinstall (most don't). Otherwise just confirm the lockfile updated and move on.

## Resolution rules

Continue to Step 3 once:

- The PostHog SDK package(s) are listed in the project's manifest.
- No init code has been added.
- The matching integration skill (if any) is installed under `.claude/skills/`.
