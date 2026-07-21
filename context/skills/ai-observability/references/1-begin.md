---
next_step: 2-install.md
title: AI Observability Setup - Begin
description: Pick the right variant, confirm prerequisites, and locate the LLM call sites before editing
---

Before touching any code, decide which variant of this skill to install, confirm the two prerequisites, and get a read on where in the project LLM calls actually happen. AI Observability instruments an existing setup — if the setup isn't there, this skill can't do its job.

## Pick the variant

The `ai-observability` skill has one variant per LLM provider × language (e.g. `ai-observability-openai-python`, `ai-observability-anthropic-node`, …). You are running the group-level entry; before installing, pick the specific variant that matches this project.

Scan the manifest (`package.json`, `pyproject.toml`, `requirements.txt`, `Gemfile`) for a vendor LLM package. Typical package names:

- OpenAI — `openai`
- Anthropic — `@anthropic-ai/sdk` (Node) or `anthropic` (Python)
- LangChain — `langchain` / `@langchain/core` (plus a provider adapter like `langchain-openai` / `@langchain/openai`)
- Vercel AI SDK — `ai` (plus a provider like `@ai-sdk/openai`)
- Google Gemini — `google-genai` (Python) or `@google/genai` (Node)

Decision rules — apply in order:

1. **Exactly one vendor SDK found** → pick the corresponding variant. Language follows the manifest (`package.json` → Node, `pyproject.toml`/`requirements.txt` → Python). Tell the user which variant you picked and why in a `[STATUS]` line, then call `install_skill` with the full variant id (e.g. `ai-observability-openai-python`).
2. **Multiple vendor SDKs found** (e.g. LangChain wraps OpenAI, so both may be declared) → prefer the higher-level abstraction: LangChain > direct provider SDK. If still ambiguous, use `wizard_ask` to have the user pick, listing the candidates as options.
3. **No vendor SDK found** → install `ai-observability-manual-capture`. This variant posts `$ai_generation` events explicitly and works without any auto-instrumentation.
4. **You're not sure** → `wizard_ask` the user with a multi-choice picker listing every provider you have a variant for. Do not guess when there's real ambiguity.

## Check for an existing PostHog setup (informational — not a blocker)

Grep the project for one of:

- `posthog.init(` — most JS/TS SDKs
- `PostHog(` — Python, Ruby, Go SDK constructors
- `AddPostHog(` — .NET DI registration

**This is not a prerequisite.** The OTel-based variants use `PostHogSpanProcessor`, a self-contained exporter that just takes an API key + host — it does not depend on a `posthog.init(...)` call anywhere. The `manual-capture` variant uses `posthog.capture(...)`, which needs the traditional SDK, but the install step will add it if it isn't there.

If a `posthog.init(...)` (or equivalent) **is** already present, note the env-var names it reads (`POSTHOG_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, etc.) and reuse them in `3-otel-setup.md` — don't invent parallel names. If nothing is there, `3-otel-setup.md` will set fresh values via `set_env_values`.

## Locate the LLM call sites

Grep for where the vendor SDK is imported and called. This is not a full analysis — one or two representative sites is enough for you to reason about where OTel initialization has to run before those calls execute:

- OpenAI: `import OpenAI`, `openai.OpenAI(`, `new OpenAI(`
- Anthropic: `Anthropic(`, `new Anthropic(`
- LangChain: `ChatOpenAI(`, `from langchain`, `import { ChatOpenAI } from '@langchain/openai'`
- Vercel AI: `generateText(`, `streamText(`, `import ... from 'ai'`
- Google Gemini: `genai.Client(`, `new GoogleGenerativeAI(`

Note the app's entry point (server startup file, `main.py`, `index.ts`, `instrumentation.ts` in Next.js, etc.) — OTel must be initialized *before* the vendor SDK is imported, and the entry point is where that happens.

Do not edit yet. Once you have a note of the entry point and the call sites, move on to `2-install.md`.
