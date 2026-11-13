# Add error tracking

Follow the framework's own mechanism for a global error handler, using the
reference example and the docs for the exact pattern. Find the init or app entry,
add the handler there.

If the app already has natural exception boundaries — a server-side API error
handler, a critical flow with its own try/catch — capturing there too is worth a
single edit. The global handler is the floor, not the only place errors matter.

## Reference

{references}
