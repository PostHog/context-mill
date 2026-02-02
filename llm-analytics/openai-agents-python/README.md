# OpenAI Agents SDK + PostHog LLM Analytics (Python)

Track OpenAI Agents SDK usage with PostHog analytics.

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

- Call `instrument()` from `posthog.ai.openai_agents` to register PostHog tracing
- All agent traces, spans, tool calls, handoffs, and LLM generations are captured automatically
- Captures `$ai_generation` events for LLM calls and `$ai_span` events for agent execution
