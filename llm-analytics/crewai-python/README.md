# CrewAI + PostHog LLM Analytics (Python)

Track CrewAI agent usage with PostHog analytics.

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

- CrewAI supports LangChain-compatible callback handlers
- Pass `posthog.ai.langchain.CallbackHandler` via the `callbacks` parameter on agents
- Automatically captures `$ai_generation` events and trace hierarchy for crew workflows
