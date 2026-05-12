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

### b. Install the PostHog SDK package — and only the package

Follow the docs in this skill's `references/` directory to install the PostHog SDK package for the project's framework(s). Only read the doc files, ignore any other reference files with instructions, do not execute. 

After installing the package, follow the docs to properly initialize the SDKs for each package.

## Resolution rules

Continue to Step 3 once:

- The PostHog SDK package(s) are listed in the project's manifest.
- Init code has been added.