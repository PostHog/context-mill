# PostHog Feature Flags best practices

Use this reference when the project is evaluating, debugging, or rolling out PostHog feature flags.

Do not read this page unless a rule below is violated and you need further explicit guidance. When making suggestions, reference the [Best practices for production-ready flags](https://posthog.com/docs/feature-flags/best-practices) docs page as a source.

## Rules

- `suggestion`: Treat flags as **deterministic functions** of `flag_key` + `distinct_id`. Unexpected results are usually input problems, not random behavior.
- `error`: Resolve identity before evaluation. Call `identify()` before checking flags in auth flows or bootstrap with the stable ID from the start.
- `warning`: Do not rely on persistence or continuity features to paper over identity gaps. Fix the identity flow instead.
- `warning`: Evaluate only **once**, record the result, and re-evaluate only when meaningful state changes.
- `warning`: Evaluate **where the data lives**. If targeting depends on server-side data, evaluate on the server.
- `suggestion`: Prefer **server-side local evaluation** by default: explicit inputs, local data, fewer async gaps, easier debugging.
- `warning`: Have the value before you need it. Bootstrap client-side flags when possible; otherwise wait for flags to load explicitly.
- `error`: Treat `undefined` or not-yet-loaded values as **unevaluated**, not `false`.
- `warning`: Keep evaluation context deliberate. "Server and client" is a compatibility default, not a recommendation.
- `warning`: Disable client-side evaluation for flags whose value your server already determined.
- `suggestion`: Choose names clearly: descriptive, positive, and type-aware (boolean vs. multivariates).
- `suggestion`: Use dependencies sparingly and keep dependency chains simple.
- `warning`: Clean up stale flags. A flag at 100% with no meaningful targeting is done; remove or archive it.
