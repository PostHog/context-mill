# Add error tracking

Wire the framework's single global path for uncaught errors and exceptions to
PostHog — one handler, not hand-wrapped across files.

Use the SDK's own integration; do not hand-roll one. Where the framework ships a
PostHog middleware or handler, add that — it captures exceptions and request
context for you (e.g. Django:
`posthog.integrations.django.PosthogContextMiddleware` in `MIDDLEWARE`). Where
you must capture manually, call `posthog.capture_exception(e)` from the
framework's central error handler — never hand-construct an exception event with
`posthog.capture(...)`. Follow the framework rules (COMMANDMENTS) and the
reference for the exact pattern.

Find the init or app entry, wire it once, and you are done — don't read through
the whole app or wrap individual components or routes by hand.

## Reference

{references}
