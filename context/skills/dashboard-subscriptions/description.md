# Set up a subscription and alerts so a dashboard reaches an inbox

This sets up a real recurring email and enrols the user in alert notifications for
a target dashboard.

Call `user-get` with uuid `@me` for the current user's id and email. If no email
comes back (service account, unusual SSO), skip the subscription — don't invent a
recipient, note the skip — and still create the alerts, which key off the id, not
the email.

1. **One dashboard subscription (`subscriptions-create`).** Weekly email digest of
   the target dashboard: `target_type: "email"`, `target_value` set to the user's
   email from `user-get`, `dashboard` set to the dashboard id,
   `dashboard_export_insights` set to up to 6 of its insight ids (or fewer if the
   dashboard has fewer), `frequency: "weekly"`, `interval: 1` (every 1 week),
   `start_date` set to now. Leave `summary_enabled` off — enabling AI summaries
   needs its own separate human OK.
2. **One or two insight alerts (`alert-create`)**, only on the insight(s) that
   would actually cost the business something if they moved the wrong way — a
   conversion funnel dropping, a churn/drop-off event spiking, signups stalling.
   Skip "nice to watch" insights (e.g. a raw pageview count), and if nothing on
   the dashboard clearly qualifies, create zero rather than padding to the
   ceiling. For a funnel step, use `condition: { type: "relative_decrease" }` with
   a `FunnelsAlertConfig`; for a trend that should stay above/below a bound, use a
   `TrendsAlertConfig` with `threshold.configuration.bounds`. Set
   `subscribed_users` to `[<the numeric id from user-get>]` (the integer id, not
   the uuid) and `calculation_interval: "daily"` unless the insight's own interval
   argues for something coarser.

The create calls return the new records but not a link, so build each URL with
`generate-app-url` from the ids you just got back — never hand-construct these
paths. For the subscription, call `generate-app-url` with `url` set to
`/dashboard/{id}/subscriptions/{subscriptionId}` and `params`
`{ "id": <dashboard id>, "subscriptionId": <id from subscriptions-create> }`. For
each alert, call `generate-app-url` with `url` set to
`/insights/{insightShortId}/alerts` and `params`
`{ "insightShortId": <short id of the alert's insight> }`.

When writing up what was created, briefly explain what a subscription is (a
recurring email snapshot of the dashboard) and what an alert is (a one-off email
the moment a specific metric crosses a threshold), and name which insight(s) got
an alert and why they were judged the highest-signal ones. Remind the user to
check the subscription and alert(s) went to the right inbox and cadence — the
defaults are their account email and a weekly/daily schedule.
