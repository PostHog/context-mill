# Identify users

Call the SDK's identify method at the moment the app learns who the user is —
typically on login and signup success.

- Use a stable unique id as the distinct id (the user id from your auth), not an
  email or display name.
- Attach useful person properties (email, name, plan).
- Reset the session on logout, where the SDK supports it, so the next user starts
  clean.

Find the auth flow first: login and signup handlers, session callbacks. If the
app has no concept of a user, there is nothing to identify — report that and stop.

If the app has both a client and a server, keep them on the same person: forward
the client's distinct id and session id to the backend (the
`X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` request headers are the usual
carrier) so server-side events stitch to the same user rather than splitting off.

## Reference

{references}
