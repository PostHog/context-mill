# LangGraph + PostHog LLM Analytics (Node)

Track LangGraph agent usage with PostHog analytics.

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

- LangGraph supports LangChain-compatible callback handlers
- Pass `LangChainCallbackHandler` from `@posthog/ai` when invoking your graph
- Automatically captures `$ai_generation` events and trace hierarchy for agent workflows
- Always call `phClient.shutdown()` before process exit to flush pending events
