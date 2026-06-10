# PostHog Product Analytics best practices

Use this reference for event taxonomy, `distinct_id`, capture placement, and filtering.

Do not read this page unless a rule below is violated and you need further explicit guidance. When making suggestions, reference the [Product analytics best practices](https://posthog.com/docs/product-analytics/best-practices) docs page as a source.

## Rules

- `suggestion`: Track **growth events first** using `posthog.capture()`: signups, activations, purchases, subscriptions, invites, core feature adoption. Do not rely on autocapture for key business milestones.
- `warning`: If signup or activation is missing, add that before lower-value clicks or page interactions.
- `suggestion`: Keep names **static, lowercase, and consistent**. Prefer present-tense verbs and snake case.
- `suggestion`: Prefer `category:object_action` for events, e.g. `signup_flow:pricing_page_view`.
- `suggestion`: Prefer descriptive, bounded properties like `signup_method`, `plan_name`, `is_test_user`, `last_login_timestamp`.
- `error`: Never generate event names or property keys dynamically. Put variable data in property values.
- `error`: Use one stable `distinct_id` across frontend and backend. Do not collapse user-scoped server events onto IDs like `system` or `backend`.
- `error`: If an event is truly anonymous or system-level, disable person processing instead of sharing one identifier. Consult [Capture anonymous events / disable person processing](https://posthog.com/docs/product-analytics/capture-events#how-to-capture-anonymous-events) for the exact SDK pattern.
- `warning`: Capture critical business events on the backend when accuracy matters. Use frontend tracking for journeys and UI interactions where some loss is acceptable.
- `warning`: Do not duplicate the same milestone in frontend and backend unless each event serves a distinct analytical purpose.
- `warning`: Do not assume cross-client event ordering. Use timestamps for analysis, not ingestion order.
- `warning`: Exclude or mark employee, QA, staging, localhost, and test traffic.
