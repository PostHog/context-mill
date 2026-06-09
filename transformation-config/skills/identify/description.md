# Identify users

Call `posthog.identify` at the moment the app learns who the user is — typically
on login and signup success.

- Use a stable unique id as the distinct id (the user id from your auth), not an
  email or display name.
- Pass useful person properties (email, name, plan) as the second argument.
- Call `posthog.reset()` on logout so the next user starts clean.

Find the auth flow first: login and signup handlers, session callbacks. If the
app has no concept of a user, there is nothing to identify — report that and stop.

## Reference

{references}
