---
next_step: 2-scan.md
---

# Step 1 – Detect SDKs

Seed the audit checklist, then find every PostHog SDK in the project and remember which language(s) and framework(s) the rest of the audit will work on. **Read-only on the codebase.** Don't scan code for capture sites – that's step 2.

## Tools

Load via `ToolSearch select:Read,Glob,mcp__wizard-tools__audit_seed_checks,mcp__wizard-tools__audit_resolve_checks` once at the start of this step.

## Status

Emit, in order:

```
[STATUS] Seeding audit checklist
[STATUS] Detecting SDKs
```

## Action

### a. Seed the audit checklist

The checklist lives at `.posthog-audit-checks.json` and renders live in the "Audit plan" tab. **Don't rely on the runtime pre-seeding it** — call `mcp__wizard-tools__audit_seed_checks` directly here. The tool replaces the file atomically, so calling it once at the start of every run is safe.

Pass exactly these three shared checks (`identity-segmentation`, `coverage-map`, `data-quality`):

```json
{
  "checks": [
    { 
      "id": "identity-segmentation", 
      "area": "Identity",     
      "label": "Identity & segmentation", 
      "status": "pending" 
    },
    { 
      "id": "coverage-map",          
      "area": "Coverage",     
      "label": "Coverage map",            
      "status": "pending" 
    },
    { 
      "id": "data-quality",          
      "area": "Data quality", 
      "label": "Data quality",            
      "status": "pending" 
    }
  ]
}
```

Don't invent new ids — later steps resolve checks by these exact ids. Don't `Write` the file directly; the MCP tool owns it.

### b. Find PostHog SDKs

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
