# Pydantic AI + PostHog LLM Analytics (Python)

Track Pydantic AI agent usage with PostHog analytics.

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

- Create a PostHog `AsyncOpenAI` wrapper and pass it via an `OpenAIProvider` to Pydantic AI's `OpenAIChatModel`
- PostHog's wrapper is a proper subclass of `openai.AsyncOpenAI`, so it works directly
- Every LLM call captures an `$ai_generation` event in PostHog
