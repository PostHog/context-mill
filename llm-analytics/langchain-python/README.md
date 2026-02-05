# LangChain + PostHog LLM Analytics (Python)

Track LangChain LLM usage with PostHog analytics.

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

- `posthog.ai.langchain.CallbackHandler` is a LangChain-compatible callback handler
- Pass it in the `config` when invoking chains: `config={"callbacks": [callback_handler]}`
- Automatically captures `$ai_generation` events and trace hierarchy
- The handler does **not** proxy calls — it only sends analytics events asynchronously
