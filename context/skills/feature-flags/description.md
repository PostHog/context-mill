# PostHog feature flags for {display_name}

This skill adds a real PostHog feature flag to an existing {display_name} application. It inspects the application, finds or creates the flag, implements one safe use case, verifies the result, and leaves a short report.

## Workflow

{workflow}

Start with `references/1-assess.md` and follow the steps in order. Each step links to the next one. Do not skip directly to implementation or preload every reference.

## Reference files

{references}

The workflow references control the job. Consult the framework documentation and `COMMANDMENTS.md` for API details and implementation patterns when a step asks for them.

## Key principles

- **Existing integration**: This workflow requires a working PostHog SDK integration. It does not install PostHog from scratch.
- **Idempotent flag management**: Reuse an exact flag key. Never create a duplicate or silently change an existing flag's conditions, rollout, or evaluation context.
- **Conservative rollout**: Do not expose a new experience broadly without the user's explicit intent.
- **Minimal changes**: Add the flag alongside existing logic without restructuring unrelated code.
- **Boolean flags first**: Use a boolean flag unless the requested behavior needs variants or a payload.
- **Safe evaluation**: Resolve identity first, handle loading and failure states explicitly, and keep authorization or other security decisions outside feature flags.
- **Configuration and secret handling**: Follow the framework's supported configuration pattern. For environment-backed apps, check variable names and presence without reading values. The project token is a public client-side key, but do not print it or include it in reports. Never expose personal API keys, OAuth tokens, or other secrets to the model.
- **Evidence-based completion**: Local SDK state, a queued event, or a passing build does not prove PostHog received a live evaluation. Report each verification layer separately.

## Framework guidelines

{commandments}
