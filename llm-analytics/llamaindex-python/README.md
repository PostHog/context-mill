# LlamaIndex + PostHog LLM Analytics (Python)

Track LlamaIndex LLM usage with PostHog analytics.

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

- Create a PostHog OpenAI wrapper and inject it as `llm._client` on LlamaIndex's OpenAI LLM
- PostHog's wrapper is a proper subclass of `openai.OpenAI`, so it replaces the internal client
- Every LLM call captures an `$ai_generation` event in PostHog
