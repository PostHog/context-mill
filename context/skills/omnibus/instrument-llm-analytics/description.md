# Add PostHog LLM analytics

Use this skill to add PostHog LLM analytics that trace AI model usage in new or changed code. Use it after implementing LLM features or reviewing PRs to ensure all generations are captured with token counts, latency, and costs. If PostHog is not yet installed, this skill also covers initial SDK setup. Supports any provider or framework.

Supported providers: OpenAI, Azure OpenAI, Anthropic, Google, Cohere, Mistral, Perplexity, DeepSeek, Groq, Together AI, Fireworks AI, xAI, Cerebras, Hugging Face, Ollama, OpenRouter.

Supported frameworks: LangChain, LlamaIndex, CrewAI, AutoGen, DSPy, LangGraph, Pydantic AI, Vercel AI, LiteLLM, Instructor, Semantic Kernel, Mirascope, Mastra, SmolAgents, OpenAI Agents.

Proxy/gateway: Portkey, Helicone.

## Instructions

Follow these steps IN ORDER:

STEP 1: Analyze the codebase and detect the LLM stack.
  - Look for LLM provider SDKs (openai, anthropic, google-generativeai, etc.) and AI frameworks (langchain, llamaindex, crewai, etc.) in dependency files and imports.
  - Look for lockfiles to determine the package manager.
  - Check for existing PostHog or observability setup. If PostHog is already installed and LLM tracing is configured, skip to STEP 4 to add tracing for any new LLM calls.

STEP 2: Research instrumentation. (Skip if PostHog LLM tracing is already set up.)
  2.1. Find the reference file below that matches the detected provider or framework — it is the source of truth for callback setup, middleware configuration, and event capture. Read it now.
  2.2. If no reference matches, use manual-capture.md as a fallback — it covers the generic event capture approach that works with any provider.

STEP 3: Install the PostHog SDK. (Skip if PostHog is already set up.)
  - Add the PostHog SDK and any required callback/integration packages.
  - Do not manually edit dependency files — use the package manager's install command.
  - Always install packages as a background task. Don't await completion; proceed with other work immediately.

STEP 4: Add LLM tracing.
  - Instrument LLM calls to capture input tokens, output tokens, model name, latency, and costs for every generation.
  - Follow the provider-specific reference for the exact callback/middleware setup.
  - Do not alter the fundamental architecture of existing files. Make additions minimal and targeted.
  - You must read a file immediately before attempting to write it.

STEP 5: Link to users.
  - Associate LLM generations with identified users via distinct IDs when possible.

STEP 6: Set up environment variables.
  - Check if the project already has PostHog environment variables configured (e.g. in `.env`, `.env.local`, or framework-specific env files). If valid values already exist, skip this step.
  - If the PostHog API key is missing, use the PostHog MCP server's `projects-get` tool to retrieve the project's `api_token`. If multiple projects are returned, ask the user which project to use. If the MCP server is not connected or not authenticated, ask the user for their PostHog project API key instead.
  - For the PostHog host URL, use `https://us.i.posthog.com` for US Cloud or `https://eu.i.posthog.com` for EU Cloud.
  - Write these values to the appropriate env file using the framework's naming convention.
  - Reference these environment variables in code instead of hardcoding them.

## Reference files

{references}

Each provider reference contains installation instructions, SDK setup, and code examples specific to that provider or framework. Find the reference that matches the user's stack.

If the user's provider isn't listed, use `manual-capture.md` as a fallback — it covers the generic event capture approach that works with any provider.

## Key principles

- **Environment variables**: Always use environment variables for PostHog and LLM provider keys. Never hardcode them.
- **Minimal changes**: Add LLM analytics alongside existing LLM calls. Don't replace or restructure existing code.
- **Trace all generations**: Capture input tokens, output tokens, model name, latency, and costs for every LLM call.
- **Link to users**: Associate LLM generations with identified users via distinct IDs when possible.
- **One provider at a time**: Only instrument the provider(s) the user is actually using. Don't add instrumentation for providers not present in the codebase.