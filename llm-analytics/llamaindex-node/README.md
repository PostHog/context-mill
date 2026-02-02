# LlamaIndex + PostHog LLM Analytics (Node)

Track LlamaIndex LLM usage with PostHog analytics.

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

- Create a PostHog OpenAI wrapper and inject it into LlamaIndex's OpenAI LLM
- Every LLM call captures an `$ai_generation` event in PostHog
- Always call `phClient.shutdown()` before process exit to flush pending events
