# LangGraph + PostHog LLM Analytics (Python)

Track LangGraph agent usage with PostHog analytics.

## Quick start

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in your API keys:

   ```bash
   cp .env.example .env
   ```

3. Run the example:

   ```bash
   python main.py
   ```

## How it works

- LangGraph is built on LangChain, so it supports LangChain-compatible callback handlers
- Pass `posthog.ai.langchain.CallbackHandler` in the `config` when invoking your graph
- Automatically captures `$ai_generation` events and trace hierarchy for agent workflows
