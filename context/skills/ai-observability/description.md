# PostHog AI Observability for {display_name}

Wire up PostHog's AI Observability so calls made through {display_name} land in LLM Analytics as a full **session → trace → span → generation** tree — not just isolated `$ai_generation` events.

## Prerequisite — vendor LLM SDK

This skill instruments the LLM calls the project *already makes*. It does **not** install the vendor SDK for you.

Check the project's manifest for an LLM package. The catalog is far wider than the obvious providers — 69 variants covering agent frameworks (`openai-agents`, `claude-agent-sdk`, LangGraph, CrewAI, Mastra, …) and OpenAI-compatible gateways (Groq, OpenRouter, Together, Ollama, …), which an app reaches through the `openai` package plus a `baseURL` override. `1-begin.md` carries the ordered decision rules; follow them rather than matching on the first familiar package name. If no LLM SDK is present, switch to the `manual-capture` variant — it posts `$ai_generation` events directly and works standalone.

Everything else this skill needs — PostHog credentials, instrumentation packages, env vars — the skill installs and configures itself. It does **not** require a pre-existing `posthog.init(...)`. If one is already there, reuse its env-var names in `3-instrument.md`; if not, that step sets fresh values via `set_env_values`.

## Steps

Read every referenced file **before editing**. Then work through them in order:

1. **Begin** — see `references/1-begin.md`. Pick the variant with the ordered rules (framework before provider, gateway base URL before the SDK it borrows), then read four facts from the code: the conversation, the user, the turn, and whether the app registers tools.
2. **Install** — see `references/2-install.md`. Declare the variant's packages in the manifest — and only those. For providers and gateways that's the PostHog SDK alongside the vendor SDK, with no OpenTelemetry packages.
3. **Instrument** — see `references/3-instrument.md`. Swap the vendor client for PostHog's wrapper, attach `$ai_session_id`, a per-turn `posthog_trace_id`, and the distinct id to every call, and capture tool runs as `$ai_span` events. This step is what turns isolated generations into a session tree.
4. **Verify** — see `references/4-verify.md`. Describe a request the user can trigger, and grade what lands in PostHog — one session, grouped traces, right attribution — rather than what the diff contains.

## Reference files

{references}

The linked install page carries the exact code blocks for this variant's language. Prefer copying from there over reconstructing from memory — package names and initialization shapes change between AIO releases.

## Key principles

- **Environment variables.** Read `<ph_project_token>` and `<ph_client_api_host>` from env, using the framework's env-var convention. Never hardcode either value.
- **The SDK wrapper is the default, not OpenTelemetry.** OTel makes the session tree awkward to build and maintain, so provider and gateway variants use PostHog's drop-in wrapper client. Reserve OTel for the `opentelemetry-*` variants and LlamaIndex, and never swap a framework's own tracing hook for an instrumentor. Go is the exception: it has no wrapper SDK, so model calls made from Go use the `opentelemetry-go` bridge.
- **Minimal changes.** The wrapper swaps a client constructor and adds parameters to existing calls. Don't restructure the app, and don't wrap the setup in an init function or module globals.
- **Match the docs.** Package names and wrapper imports change between AIO releases. The install page for this variant is the source of truth.
- **Cardinality is what gets graded.** One `$ai_session_id` per conversation, one `posthog_trace_id` per turn, shared by every call in it. An id minted per call is worse than none — it looks instrumented and groups nothing.
- **Tools become spans.** When the app registers tools, capture each execution as an `$ai_span` event sharing the turn's trace id — the wrapper never sees your dispatch loop. Framework variants emit these themselves; an app with no tools correctly has none.
- **Don't touch what isn't yours.** This skill instruments LLM observability only — generations, traces, sessions, spans. Identify calls, event tracking, error tracking, and dashboards belong to the base `integration` skill — do not add or edit them here.

## Emit a run record

When you finish, write `.posthog-wizard-cache/.posthog-ai.json` at the project root:

```json
{ "provider": "openai", "package": "@posthog/ai", "otel_init_file": "src/instrumentation.ts" }
```

`otel_init_file` keeps its name for the report's sake, but on the wrapper path there is no OTel init — set it to the file where the wrapper client was constructed (or, on the manual path, where the capture helper lives).

The `report/` step reads this file to render an AI Observability section in the setup report. If the cache directory does not exist, create it.

## Framework guidelines

{commandments}
