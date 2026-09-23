# Evaluate the example feature flags

Add one evaluation for each example flag you were given, on that flag's own
side of the app, following the framework's flag docs and the best-practices
reference below. The backend flag is evaluated in server code with the server
SDK; the frontend flag in browser or device code with the client SDK. Never
evaluate a flag on the other side.

On the backend, evaluate once per request and pass the result down; never
re-evaluate the same flag deeper in the call stack. Keep each flag key in a
constants module rather than as a string literal at the call site. Use the
identified user's distinct id for evaluation, the same id on both sides, and
report each evaluation back to PostHog the way the docs show for that SDK.

Do not refactor unrelated code or add flags beyond the ones you were given.

## Reference

{references}
