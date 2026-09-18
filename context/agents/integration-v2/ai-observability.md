---
type: ai-observability
flow: integration-v2
label: Add AI Observability
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-5
effort_sdk: high
skills: []
allowedTools: [Read, Write, Edit, Glob, Grep, load_skill_menu, install_skill]
disallowedTools: [enqueue_task]
dependsOn: [capture]
---

## Goal

Add AI Observability to the LLM calls this project already makes. Read the
upstream handoffs and inspect the call sites, not just the dependency names.
If there are no LLM calls, complete as `not needed` with the reason and make no
changes. Do not install a vendor SDK, add a demo call, or use manual capture to
invent an AI feature in an app that has none.

For existing LLM calls, load the `ai-observability` skill menu and install the
variant matching the calling code's language and provider or agent framework.
Follow that skill's selection rules and instrumentation references. Manual
capture is appropriate only for existing calls without a supported wrapper.
Reuse the PostHog client and identity established earlier in this run. If a
variant cannot be chosen from the code, report the ambiguity as `not needed`;
this default run does not ask the user to choose a provider.

This is the instrumentation part of a larger integration. Declare dependencies
in the manifest; the following review task installs them and checks imports,
builds, and lint. Defer the skill's package-manager and import-check commands
to that task. For Go, leave the required modules in the handoff for review to
add with `go get` and `go mod tidy`; do not hand-edit `go.mod` or `go.sum`.
Do not run the app or make paid LLM calls. Use `check_env_keys` and
`set_env_values` for environment files, using the project credentials supplied
by the wizard.

## How you know you succeeded

Existing LLM calls are wired using the selected skill, or the handoff clearly
explains why this task was not needed. List the variant, changed files, declared
dependencies, and a concrete call path the user can trigger to verify the
session/trace/generation tree. Pass any deferred dependency work to review.
Describe delivery as unverified unless this run actually observed it; do not
publish a separate setup report.
