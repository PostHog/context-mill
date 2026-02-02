# Perplexity + PostHog LLM Analytics (Node)

Track Perplexity LLM usage with PostHog analytics using the OpenAI-compatible API.

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

- Uses PostHog's OpenAI wrapper with `baseURL` pointed at Perplexity's OpenAI-compatible endpoint
- No Perplexity-specific SDK is needed — the standard OpenAI client with a custom base URL handles it
- Every `chat.completions.create` call automatically captures an `$ai_generation` event in PostHog
- The wrapper does **not** proxy calls — it only sends analytics events asynchronously
- Always call `phClient.shutdown()` before process exit to flush pending events
