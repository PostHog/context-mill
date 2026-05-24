---
title: Install and initialize PostHog
next_step: 3-plan.md
---

# Step 2, install and initialize PostHog

PostHog is not yet in the project. This step adds it via the framework's integration skill so later steps have something to migrate into.

## Status

Emit `[STATUS] Detecting project framework`, then `[STATUS] Installing matching integration skill`, then `[STATUS] Installing and initializing PostHog SDK` as you work.

## Detect the framework

Glob for the project's dependency manifests across every language PostHog ships an SDK for.

- `package.json`, npm or pnpm or yarn (Node, web, React, Next.js, Nuxt, Vue, Svelte, Angular, React Native, Expo).
- `requirements.txt`, `pyproject.toml`, `Pipfile`, `setup.py`, Python (Django, Flask, FastAPI, etc.).
- `Gemfile`, Ruby or Ruby on Rails.
- `composer.json`, PHP or Laravel.
- `go.mod`, Go.
- `build.gradle`, `build.gradle.kts`, `pom.xml`, Java or Android.
- `Podfile`, `Package.swift`, iOS or Swift.
- `pubspec.yaml`, Flutter or Dart.
- `*.csproj`, .NET.
- `mix.exs`, Elixir.

Read enough of them to identify the framework the project sits on and the package manager. If nothing matches, emit `[ABORT] No project framework detected` and stop.

## Install the matching integration skill

Call `mcp__wizard-tools__load_skill_menu({ category: "integration" })` to see what is available. Then call `mcp__wizard-tools__install_skill({ skillId: "<id>" })` with the single id that matches the framework you detected. Pick one, do not install multiple.

If no integration skill matches, remember that as the install outcome so Step 3 can record it in the plan file. The remaining steps still run, but the operator will need to wire up PostHog by hand before verify passes.

## Install and initialize PostHog

Follow the integration skill's instructions to add the PostHog SDK and initialize it. Keep PostHog keys in environment variables. Stay within the integration skill's scope. Do not start migrating source SDK call sites yet, and do not remove the source SDK, those happen in Steps 4 and 5.

Do **not** run the package manager here. Just add the PostHog SDK entry to the project's manifest (`package.json` or equivalent) at the correct workspace and version. Step 5 runs `install` once and resolves any package-manager issues. This avoids burning the run on sandbox / pinned-version / lockfile problems before any code changes exist.

## Carry the outcome forward

The plan file does not exist yet, so this step does not write anything to disk beyond what the integration skill writes. Remember whether the install passed or errored, plus the integration skill id you used, so Step 3 can record it.

Continue to `3-plan.md`.
