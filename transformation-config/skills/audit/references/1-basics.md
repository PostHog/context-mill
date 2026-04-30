# Step 1 — Basics (parallel)

The 9 basic checks (Installation, Identification, Event Capture) are already seeded in the ledger. This step starts with a quick parent-side SDK presence check, then dispatches three parallel subagents to resolve the rest.

## TodoWrite

This is the **first** TodoWrite of the run. Pass the literal **array** below as `todos` — not a JSON string:

```
todos: [
  { content: "Audit",  status: "in_progress", activeForm: "Running audit" },
  { content: "Report", status: "pending",     activeForm: "Writing report" }
]
```

## Status

```
[STATUS] Checking for PostHog SDK
```

## Action — gate before fan-out

Before dispatching subagents, confirm the project actually uses PostHog. This is the cheapest, most decisive gate — no point spinning up three subagents against a project that doesn't have the SDK.

### a. Find the SDK

Issue **one** `Grep`: `pattern: "posthog"`, `glob: "**/package.json,**/requirements.txt,**/pyproject.toml,**/Gemfile,**/composer.json,**/build.gradle,**/Podfile"`, `output_mode: "content"`, `-i: true`, `-n: true`. This single call returns every dependency manifest line that mentions PostHog with `path:line`.

If the result is empty, emit `[ABORT] No PostHog SDK found` and stop. The wizard catches `[ABORT]` and terminates the run.

If you need more context (which framework, etc.), `Read` **at most one** manifest — pick the one with the strongest match.

### b. Resolve `sdk-installed` immediately

Single call to `mcp__wizard-tools__audit_resolve_checks` with one update:

```
{
  "updates": [
    { "id": "sdk-installed", "status": "pass", "file": "<path:line>", "details": "<sdk>@<version>" }
  ]
}
```

Record the SDK package name, installed version, and framework name — you'll pass them into the 1.a subagent so it doesn't have to re-discover them.

## Action — fan out

```
[STATUS] Auditing basics in parallel (SDK · identification · event capture)
```

Your **next message must contain exactly three `Task` tool_use blocks and nothing else** — no thinking-then-dispatch, no preamble text. Issuing the three calls in separate messages defeats the parallelism.

When all three return, this step is done. Continue to step 2.

### Task 1.a — SDK basics (init + version)

```
description: "1.a · SDK basics"
prompt: "Read .claude/skills/audit/references/subagent-sdk.md and follow it exactly.\n\nWorking directory: <wizard's working directory>.\n\nDetected SDK: <sdk-package-name>@<installed-version>.\nDetected framework: <framework-name>.\nFound at: <path:line>."
```

### Task 1.b — Identification

```
description: "1.b · Identification"
prompt: "Read .claude/skills/audit/references/subagent-identification.md and follow it exactly. Working directory: <wizard's working directory>."
```

### Task 1.c — Event capture

```
description: "1.c · Event capture"
prompt: "Read .claude/skills/audit/references/subagent-event-capture.md and follow it exactly. Working directory: <wizard's working directory>."
```
