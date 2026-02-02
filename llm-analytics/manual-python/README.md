# Manual LLM Analytics Capture (Python)

Manually capture LLM analytics events with PostHog using any provider.

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

- Make LLM calls with any SDK or API
- Manually capture `$ai_generation` events with the required properties
- Required properties: `$ai_model`, `$ai_provider`, `$ai_input`, `$ai_output_choices`
- Optional: `$ai_trace_id`, `$ai_input_tokens`, `$ai_output_tokens`, `$ai_latency`
