---
type: ai-observability
flow: integration-v2
label: Add AI Observability
model_pi: openai/gpt-5.6-terra
effort_pi: high
model_sdk: claude-sonnet-5
effort_sdk: high
skills: []
allowedTools: [Read, Write, Edit, Glob, Grep, load_skill_menu, install_skill]
disallowedTools: [enqueue_task]
dependsOn: [capture]
optional: true
---

## Goal

Add AI Observability to the LLM calls this project already makes. Read the
upstream handoffs and inspect the call sites, not just the dependency names.
If there are no LLM calls, complete as `not needed` with the reason and make no
changes. Do not install a vendor SDK, add a demo call, or use manual capture to
invent an AI feature in an app that has none.

Before editing, trace every entry point that can start an existing model request
through its provider call. Include HTTP routes, WebSocket handlers, background
jobs, and direct provider calls where present. Build an **inference coverage
ledger** with each entry point, outbound call or shared transport, provider,
response protocol, streaming and non-streaming modes, user and turn scope,
tool dispatch loop, and capture status. A shared transport can cover several
entries, but check that each entry really reaches it. Mark an entry covered by
existing instrumentation, newly instrumented, or excluded with a concrete
reason. Do not count a route as covered merely because another route calls the
same provider. Keep the scan bounded to inference routes and their callers.

For existing LLM calls, load the `ai-observability` skill menu and install the
variant matching each real calling path's language and provider or agent
framework. More than one variant may be needed when distinct paths use
different providers. Follow each skill's selection rules and instrumentation
references. Manual capture is appropriate only for existing calls without a
supported wrapper.
Instrument against the provider SDK version the app already uses; never
require, assume, or request an upgrade of the app's own dependencies — if the
wrapper cannot support the app's version, fall back to manual capture or
report why. Reuse the PostHog client and identity established earlier in this
run. Follow the skill's privacy-mode instructions: default new SDK clients to
`privacy_mode=False` (Python) or `privacyMode: false` (Node), so prompt and
completion content is captured. Preserve existing privacy settings, redaction,
and explicit user or project requirements. Use the variant's documented controls
where capture is configured elsewhere; do not strip manual-capture content by
default. This default run does not ask the user to choose a provider. Instrument
the paths the code identifies and mark ambiguous paths as unresolved in the
ledger. Reserve `not needed` for a project with no existing LLM calls.

This is the instrumentation part of a larger integration. Name the packages
this task needs in your handoff for review to install; do not edit dependency
manifests, and never write a version number you invented — the package manager
resolves real versions when review installs by name. Defer the skill's
package-manager and import-check commands to that task. For Go, review adds the
modules with `go get` and `go mod tidy`; do not hand-edit `go.mod` or `go.sum`.
Do not run the app or make paid LLM calls. Use `check_env_keys` and
`set_env_values` for environment files, using the project credentials supplied
by the wizard.

## How you know you succeeded

Existing LLM calls are wired using the selected skills, or the handoff clearly
explains each unresolved path. List the variants, changed files, declared
dependencies, and a concrete call path the user can trigger to verify the
session/trace/generation tree. Include the inference coverage ledger in the
handoff as a report section, with every excluded or unverified path visible.
Do not call the task complete with a silent gap. Include the skill's
**Privacy mode** handoff:
the effective setting, the file and line to edit, when to enable it, and the
[privacy-mode docs](https://posthog.com/docs/ai-observability/privacy-mode). Pass any
deferred dependency work to review.
Describe delivery as unverified unless this run actually observed it; do not
publish a separate setup report.
