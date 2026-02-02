# Azure OpenAI + PostHog LLM Analytics (Node)

Track Azure OpenAI usage with PostHog analytics.

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

- `@posthog/ai` exports an `AzureOpenAI` wrapper around the OpenAI Azure client
- Every `chat.completions.create` call automatically captures an `$ai_generation` event in PostHog
- The wrapper does **not** proxy calls — it only sends analytics events asynchronously
- Always call `phClient.shutdown()` before process exit to flush pending events
