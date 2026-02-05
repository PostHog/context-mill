# Vercel AI SDK + PostHog LLM Analytics (Node)

Track Vercel AI SDK usage with PostHog analytics.

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

- `@posthog/ai` exports a `withTracing` wrapper for Vercel AI SDK models
- Wrap your model with `withTracing(model, phClient, options)`
- Every `generateText` or `generateObject` call captures an `$ai_generation` event
- Always call `phClient.shutdown()` before process exit to flush pending events
