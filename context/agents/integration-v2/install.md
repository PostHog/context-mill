---
type: install
flow: integration-v2
label: Add the PostHog SDK to the manifest
model_pi: openai/gpt-5.6-terra
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

## How you know you succeeded

The SDK is listed in the manifest's dependencies at a sensible version. If it is
already declared, leave it and say so. Your handoff names the manifest you changed
and the package and version you declared, so the steps after you import it under
the name they will actually get.
