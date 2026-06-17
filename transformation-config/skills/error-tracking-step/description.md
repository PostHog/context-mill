# Add error tracking

Set up the framework's GLOBAL error boundary so uncaught errors and exceptions
reach PostHog — one handler, not hand-wrapped across files.

Follow the framework's own mechanism for a global error handler, using the
reference example and the docs for the exact pattern. Find the init or app entry,
add the handler there, and you are done. One handler is enough — do not read
through the whole app or wrap individual components or routes by hand.

## Reference

{references}
