# PostHog LLM analytics for {display_name}

This skill helps you add PostHog LLM analytics to {display_name} applications.

## Reference files

{references}

Consult the documentation for API details and provider-specific patterns.

## Key principles

- **Environment variables**: Always use environment variables for PostHog and LLM provider keys. Never hardcode them.
- **Minimal changes**: Add LLM analytics alongside existing LLM calls. Don't replace or restructure existing code.
- **Trace all generations**: Capture input tokens, output tokens, model name, latency, and costs for every LLM call.
- **Link to users**: Associate LLM generations with identified users via distinct IDs when possible.

## Framework guidelines

{commandments}
