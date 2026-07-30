---
next_step: null
title: Write the feature flag setup report
description: Record the implementation, PostHog state, verification evidence, and remaining work
---

# Step 5 - Write the feature flag setup report

## Status

Emit:

```text
[STATUS] Writing the feature flag setup report
```

Write to the report path supplied by the invoking program. If the invoking program does not supply one, use `posthog-feature-flags-report.md` at the project root. If a report from an earlier run exists at that path, read it before replacing it. Do not create or update a second report file.

Keep the report concise and include:

1. A one-paragraph summary of the user experience and its control behavior.
2. The selected skill ID and version from the installed `SKILL.md` metadata. Determine the source only from explicit installation evidence, such as the `install_skill` result or its source URL. A localhost or local development URL, or a `dev` skill version, means local. A menu category does not prove the skill was published. If no source evidence is available, mark the source as unavailable instead of inferring it.
3. The flag key, type, PostHog project, evaluation context, active state, release conditions, and whether the flag was created or reused.
4. A table of changed files and why each changed.
5. Any custom event name, its non-PII properties, and where it is captured.
6. A verification table with separate rows for source review, focused tests, type checking, linting, production build, both flag paths, PostHog flag read-back, live evaluation ingestion, custom event ingestion, and temporary flag-state restoration when applicable. Mark each row `verified`, `failed`, `source-reviewed`, `blocked`, or `not run`, and include the evidence. Use `verified` only when that check or behavior actually ran.
7. A "Before you merge" checklist containing only unresolved work. Do not include configuration steps already confirmed during assessment.

Keep evidence scoped to the command or observation that produced it. A passing build does not prove that linting or a separate type check ran unless the build output explicitly names and runs that check. Never infer that a linter ran from a framework convention or from a successful build.

The PostHog project token is public, but do not include it in the report because the value is unnecessary. Never include personal API keys, OAuth tokens, other secrets, full environment variable values, or personal data returned by MCP tools.

After writing the report, emit:

```text
[STATUS] Created setup report: <absolute report path>
```
