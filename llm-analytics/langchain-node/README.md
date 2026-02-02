# LangChain + PostHog LLM Analytics (Node)

Track LangChain LLM usage with PostHog analytics.

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

- `@posthog/ai` exports a `LangChainCallbackHandler`
- Pass it when invoking chains: `{ callbacks: [callbackHandler] }`
- Automatically captures `$ai_generation` events and trace hierarchy
- Always call `phClient.shutdown()` before process exit to flush pending events
