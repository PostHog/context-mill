# OpenAI + PostHog LLM Analytics (Python)

Track OpenAI LLM usage with PostHog analytics.

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

- `posthog.ai.openai.OpenAI` wraps the standard OpenAI client
- Every `chat.completions.create` call automatically captures an `$ai_generation` event in PostHog
- The wrapper does **not** proxy calls — it only sends analytics events asynchronously
- Pass `posthog_distinct_id` to associate events with a user
- Pass `posthog_trace_id` to group related LLM calls into a trace
