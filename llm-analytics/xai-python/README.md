# xAI + PostHog LLM Analytics (Python)

Track xAI LLM usage with PostHog analytics using the OpenAI-compatible API.

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

- Uses PostHog's OpenAI wrapper with `base_url` pointed at xAI's OpenAI-compatible endpoint
- No xAI-specific SDK is needed — the standard OpenAI client with a custom base URL handles it
- Every `chat.completions.create` call automatically captures an `$ai_generation` event in PostHog
- The wrapper does **not** proxy calls — it only sends analytics events asynchronously
