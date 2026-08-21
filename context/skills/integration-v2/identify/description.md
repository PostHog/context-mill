# Identify users

Identity works differently either side of the network, so work out which side you
are on before you wire anything.

On a client, call the SDK's identify method at the moment the app learns who the
user is — typically on login and signup success. The library remembers it from
there, so identify once rather than per page or per event, and reset on logout so
the next user starts clean.

On a server there is no such moment: one process serves every user at once, so
identity belongs to the request rather than to a login. Bind it once for the whole
request — through the SDK's context API, or the framework middleware where the SDK
ships one — and let the captures inside inherit it. A context around a single
capture buys nothing.

- Use a stable unique id as the distinct id (the user id from your auth), not an
  email or display name — including in server-side calls, where framework docs
  sometimes show an email in the example.
- Prove the id actually reaches the line that identifies, before you rely on it.
  Frameworks routinely withhold the id from the payload the client receives — an
  allow-list on the serialized model, a session callback that returns only name and
  email. Read the shape the code will really see at that point, not the shape of the
  record it came from. Where the id is missing, expose it deliberately at its source;
  never substitute an email, and never pass a value that can be undefined. An
  identify call built from a missing field is rejected by the SDK, and identity then
  silently never happens for anyone.
- Attach useful person properties (email, name, plan).

Find the auth flow first: login and signup handlers, session callbacks. If the
app has no concept of a user, there is nothing to identify — report that and stop.

If the app has both a client and a server, keep them in the same person and
session. Set the client SDK's `tracing_headers` to each backend hostname
(hostnames only). It adds `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` to
matching requests on its own, so do not hand-roll a fetch wrapper. Then bind both
incoming values to request-scoped PostHog context on the server. Use the SDK's
framework middleware where one exists (for example `setupExpressRequestContext`
or `PosthogContextMiddleware`); otherwise read the headers and pass the session as
`sessionId` to the server SDK's context API. Verify that the configured hostname
is the one the browser actually calls. These headers are client-controlled
analytics context: prefer the authenticated user id for security-sensitive
identity and authorization decisions.

## Reference

{references}
