---
next_step: 2-scan.md
---

# Step 1 – Detect SDKs

Seed the audit checklist, then find every PostHog SDK in the project and remember which language(s) and framework(s) the rest of the audit will work on. **Read-only on the codebase.** Don't scan code for capture sites – that's step 2.

## Tools

Load via `ToolSearch select:Read,Glob,mcp__wizard-tools__audit_seed_checks,mcp__wizard-tools__audit_resolve_checks` once at the start of this step. Subsequent steps reuse `audit_resolve_checks` to advance the phase, so it stays loaded.

## Status

Emit, in order:

```
[STATUS] Seeding audit checklist
[STATUS] Detecting SDKs
```

## Action

### a. Seed the audit checklist

The checklist lives at `.posthog-audit-checks.json` and renders live in the wizard sidebar / "Audit plan" tab. **Don't rely on the runtime pre-seeding it** — call `mcp__wizard-tools__audit_seed_checks` directly here. The tool replaces the file atomically, so calling it once at the start of every run is safe.

Seed all six pipeline phases. The wizard already pre-seeds the same shape so the sidebar boots populated; seeding again is idempotent and guarantees you own the exact labels later steps resolve against.

```json
{
  "checks": [
    {
      "id": "detect-sdk",
      "area": "Detect SDK",
      "label": "Identify PostHog SDK(s) in dependencies",
      "status": "pending"
    },
    {
      "id": "scan-sites",
      "area": "Scan capture sites",
      "label": "Grep capture/identify/group call sites",
      "status": "pending"
    },
    {
      "id": "enrich-sites",
      "area": "Enrich",
      "label": "Subagent fan-out to read capture files",
      "status": "pending"
    },
    {
      "id": "query-volume",
      "area": "Query PostHog",
      "label": "30-day volume + last_seen via MCP",
      "status": "pending"
    },
    {
      "id": "write-report",
      "area": "Write report",
      "label": "Render posthog-events-audit-report.md",
      "status": "pending"
    },
    {
      "id": "create-dashboard",
      "area": "Create dashboard",
      "label": "Optional: dashboard for resolved events",
      "status": "pending"
    }
  ]
}
```

Don't invent new ids — later steps resolve their own phase by these exact ids. Don't `Write` the file directly; the MCP tool owns it.

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

### c. Resolve the phase

Once the SDK list is in memory, call `mcp__wizard-tools__audit_resolve_checks` to flip the `detect-sdk` row to `pass`:

```json
{
  "updates": [
    { "id": "detect-sdk", "status": "pass" }
  ]
}
```

This advances the wizard sidebar to the next phase ("Scan capture sites"). Continue to step 2.
