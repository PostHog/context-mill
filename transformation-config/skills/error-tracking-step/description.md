# Add error tracking

Capture exceptions with PostHog at the points where failures matter.

- Wrap the critical paths: server route handlers, server actions, payment,
  webhook and auth endpoints, and client error boundaries.
- Use `posthog.captureException(error, { ...context })` in the catch blocks,
  with enough context to debug.
- Do not swallow errors — capture, then handle or re-throw as the code already
  does.
- Read the file before editing, and add PostHog alongside any existing error
  reporting rather than replacing it.

## Reference

{references}
