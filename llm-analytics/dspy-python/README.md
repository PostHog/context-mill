# DSPy + PostHog LLM Analytics (Python)

Track DSPy LLM usage with PostHog analytics via LiteLLM.

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

- DSPy uses LiteLLM under the hood for LLM provider access
- Configure PostHog as a LiteLLM callback to capture all LLM calls
- All DSPy module executions automatically capture `$ai_generation` events
