---
type: install
flow: integration-v2
label: Add the PostHog SDK to the manifest
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-haiku-4-5-20251001
skills: [integration-v2-install]
allowedTools: [Read, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

Declare the PostHog SDK in the project's package manifest. Do not run the package
manager and do not build — the build task installs and verifies everything at the
end.

Never invent a version number. Copy the exact dependency spec the reference example
declares (e.g. a `^1.x` range) — it is known to resolve. If the example gives none,
use a range that installs the latest published version, not a specific version you
guessed: a version that was never published fails the whole build with `ETARGET`,
and the build task cannot recover from a manifest you got wrong.

## How you know you succeeded

The SDK is listed in the manifest's dependencies at a sensible version. If it is
already declared, leave it and say so. Your handoff names the manifest you changed
and the package and version you declared, so the steps after you import it under
the name they will actually get.
