# LiteLLM + PostHog LLM Analytics (Python)

Track LLM usage across providers with LiteLLM and PostHog analytics.

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

- Set `POSTHOG_API_KEY` and `POSTHOG_API_URL` environment variables
- Add `"posthog"` to `litellm.success_callback` and `litellm.failure_callback`
- All LLM calls through LiteLLM automatically capture `$ai_generation` events
- Requires LiteLLM version 1.77.3 or higher
