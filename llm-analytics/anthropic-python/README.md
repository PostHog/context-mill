# Anthropic + PostHog LLM Analytics (Python)

Track Anthropic Claude usage with PostHog analytics.

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

- `posthog.ai.anthropic.Anthropic` wraps the standard Anthropic client
- Every `messages.create` call automatically captures an `$ai_generation` event in PostHog
- The wrapper does **not** proxy calls — it only sends analytics events asynchronously
- Also works with `AsyncAnthropic`, `AnthropicBedrock`, and `AnthropicVertex`
