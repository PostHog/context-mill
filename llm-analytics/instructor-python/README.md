# Instructor + PostHog LLM Analytics (Python)

Track Instructor structured output usage with PostHog analytics.

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

- Create a PostHog OpenAI wrapper, then pass it to `instructor.from_openai()`
- PostHog's wrapper is a proper subclass of `openai.OpenAI`, so it works directly with Instructor
- Every LLM call captures an `$ai_generation` event in PostHog
