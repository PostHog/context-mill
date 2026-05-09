---
next_step: 2-scan.md
---

# Step 1 – Detect SDKs

Find every PostHog SDK in the project and remember which language(s) and framework(s) the rest of the audit will work on. **Read-only.** Don't scan code for capture sites – that's step 2.

## Status

Emit:

```
[STATUS] Detecting SDKs
```

## Action

### a. Find PostHog SDKs

`Glob` for the project's dependency manifests across every language PostHog ships an SDK for. The full list:

- `package.json` - npm / pnpm / yarn (Node, web, React, Next.js, Nuxt, Vue, Svelte, Angular, React Native, Expo)
- `requirements.txt`, `pyproject.toml`, `Pipfile`, `setup.py` – Python (Django, Flask, FastAPI)
- `Gemfile` - Ruby / Rails
- `composer.json` - PHP / Laravel
- `go.mod` - Go
- `build.gradle`, `build.gradle.kts`, `pom.xml` – Java / Android
- `Podfile`, `Package.swift` – iOS / Swift
- `pubspec.yaml` - Flutter / Dart
- `*.csproj` - .NET
- `mix.exs` - Elixir

Read enough of them to identify which PostHog SDK the project uses, what version, and what framework it sits on top of.

If the project is a monorepo, you may find multiple PostHog SDKs.

If no PostHog SDK is anywhere in the project, emit `[ABORT] No PostHog SDK found` and stop. The wizard catches `[ABORT]` and terminates the run.

For each dependency manifest, extract every dependency whose name starts with `posthog` (e.g. `posthog`, `posthog-node`, `posthog-js`, `posthog-python`, `posthog-ruby`). Hold `{ sdk, version, manifest, framework }` per SDK in memory. The next step uses this list.

If no PostHog SDK is anywhere, emit `[ABORT] No PostHog SDK found`.
