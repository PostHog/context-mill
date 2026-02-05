# Manual LLM Analytics Capture (Node)

Manually capture LLM analytics events with PostHog using any provider.

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your API keys:

   ```bash
   cp .env.example .env
   ```

3. Run the example:

   ```bash
   npm start
   ```

## How it works

- Make LLM calls with any SDK or API
- Manually capture `$ai_generation` events with the required properties
- Required properties: `$ai_model`, `$ai_provider`, `$ai_input`, `$ai_output_choices`
- Optional: `$ai_trace_id`, `$ai_input_tokens`, `$ai_output_tokens`, `$ai_latency`
- Always call `phClient.shutdown()` before process exit to flush pending events
