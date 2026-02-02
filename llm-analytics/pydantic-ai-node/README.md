# Pydantic AI + PostHog LLM Analytics (Node)

Track LLM usage with PostHog analytics using the OpenAI wrapper (Pydantic AI pattern in Node).

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your API keys:

   ```bash
   cp .env.example .env
   ```

3. Run the example:

   ```bash
   npm start
   ```

## How it works

- Pydantic AI is Python-only, but the underlying pattern is the same: wrap the OpenAI client
- `@posthog/ai` exports an `OpenAI` wrapper that captures `$ai_generation` events
- Always call `phClient.shutdown()` before process exit to flush pending events
