# Subscription and alerts for the new dashboard

This step schedules a real recurring email and enrols the user in alert
notifications — get consent before creating anything, and skip the whole step on a
no.

On a yes, call `user-get` with uuid `@me` through `posthog_exec` for the current
user's id and email. If no email comes back (service account, unusual SSO), skip
the subscription — don't invent a recipient, note the skip in your handoff — and
still create the alerts, which key off the id, not the email.

1. **One dashboard subscription (`subscriptions-create`).** Weekly email digest of
   the dashboard just created: `target_type: "email"`, `target_value` set to the
   user's email from `user-get`, `dashboard` set to the new dashboard id,
   `dashboard_export_insights` set to up to 6 of its insight ids (or fewer if the
   dashboard has fewer), `frequency: "weekly"`, `interval: 1` (every 1 week),
   `start_date` set to now. Leave `summary_enabled` off — enabling AI summaries
   needs its own separate human OK that this consent didn't cover.
2. **One or two insight alerts (`alert-create`)**, only on the insight(s) that
   would actually cost the business something if they moved the wrong way — a
   conversion funnel dropping, a churn/drop-off event spiking, signups stalling.
   Skip "nice to watch" insights (e.g. a raw pageview count), and if nothing on
   the dashboard clearly qualifies, create zero. For a funnel step, use
   `condition: { type: "relative_decrease" }` with a `FunnelsAlertConfig`; for a
   trend that should stay above/below a bound, use a `TrendsAlertConfig` with
   `threshold.configuration.bounds`. Set `subscribed_users` to `[<the numeric id
   from user-get>]` (the integer id, not the uuid) and
   `calculation_interval: "daily"` unless the insight's own interval argues for
   something coarser.

The create calls return the new records but not a link, so build each URL with
`generate-app-url` from the ids you just got back — never hand-construct these
paths. For the subscription, call `generate-app-url` with `url` set to
`/dashboard/{id}/subscriptions/{subscriptionId}` and `params`
`{ "id": <dashboard id>, "subscriptionId": <id from subscriptions-create> }`. For
each alert, call `generate-app-url` with `url` set to
`/insights/{insightShortId}/alerts` and `params`
`{ "insightShortId": <short id of the alert's insight> }`.

In your handoff, briefly explain what a subscription is (a recurring email
snapshot of the dashboard) and what an alert is (an email the moment a specific
metric crosses a threshold), give the link for each created record, and name which
insight(s) got an alert and why they were judged the highest-signal ones — the
report step relays this to the user, including a reminder to check the recipient
and cadence defaults.
