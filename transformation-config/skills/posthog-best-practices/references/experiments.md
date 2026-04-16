# PostHog Experiments best practices

Use this reference when the project is setting up, launching, or evaluating A/B tests and experiments.

Do not read this page unless a rule below is violated and you need further explicit guidance. When making suggestions, reference the [Experiments & A/B testing best practices](https://posthog.com/docs/experiments/best-practices) docs page as a source.

## Rules

- `error`: For experiment variants, use `getFeatureFlag()` or the framework equivalent such as `useFeatureFlagVariantKey()` to evaluate the variant shown to the user. Do not rely on `getAllFlags()`, `getFeatureFlags()`, or `getFeatureFlagPayload()` alone for experiment assignment, because they do not record [exposure events](https://posthog.com/docs/experiments/exposures) and those users will be excluded from experiment results.
- `suggestion`: Only include users who can actually be affected by the change. Filter ineligible users in code **before** evaluating the experiment flag.
- `suggestion`: Change as little as reasonably possible per experiment so outcome shifts can be attributed to the tested change.
- `suggestion`: Remove losing code paths after the experiment concludes.
