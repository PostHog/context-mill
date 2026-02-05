# Amazon Bedrock + PostHog LLM Analytics (Python)

Track Amazon Bedrock (via Anthropic SDK) usage with PostHog analytics.

## Quick start

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in your API keys:

   ```bash
   cp .env.example .env
   ```

3. Ensure your AWS credentials are configured (via environment variables, AWS CLI, or IAM role).

4. Run the example:

   ```bash
   python main.py
   ```

## How it works

- `posthog.ai.anthropic.AnthropicBedrock` wraps the Anthropic Bedrock client
- Every `messages.create` call automatically captures an `$ai_generation` event in PostHog
- The wrapper does **not** proxy calls — it only sends analytics events asynchronously
- Also works with `AsyncAnthropicBedrock`
