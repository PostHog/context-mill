---
title: Detect the logging setup
next_step: 2-install.md
---

# Step 1, detect what this project already does

Discovery only. Do not modify project files. Do not write the plan file, Step 3 owns that.

You are answering four questions. Later steps depend on all four, so be specific and remember the answers.

## Status

Emit each of these as you start the matching sub task.

```
[STATUS] Detecting application runtime
[STATUS] Finding existing logging
[STATUS] Checking for PostHog SDKs
[STATUS] Locating request identity
```

## 1. Is there a runtime to instrument?

Read the dependency manifest at the project root, `package.json` for Next.js, `pyproject.toml` / `requirements.txt` / `setup.py` for Python. Confirm the runtime this skill targets is actually present, and note the framework underneath it: App Router or Pages Router for Next.js, Django or Flask or FastAPI for Python.

For Next.js, note the major version. It changes two things in Step 2: whether `instrumentation.ts` needs the `experimental.instrumentationHook` flag, and whether `after()` from `next/server` is available.

If the targeted runtime is not here at all, emit `[ABORT] No supported runtime found` and stop. That is the correct outcome, not a failure to work around.

## 2. How does it log today?

Find the logging that already exists, because Step 2 attaches to it rather than replacing it.

Look for a logging library first, `pino`, `winston`, `bunyan`, `structlog`, `loguru`, or Python's standard `logging`. Note how it is configured and where that configuration lives. If there is no library, look for bare `console.log` / `console.error` or `print`.

Record roughly how many log call sites there are and which directories they cluster in. You do not need an exact count. You need to know whether this is a codebase with a logging convention or one with scattered `console.log`, because Step 5 attaches to the former and reports honestly about the latter.

Note whether records are already structured. A logger that emits objects has somewhere to put correlation attributes. A logger emitting formatted strings does not, and Step 3 needs to know.

## 3. Is PostHog already here?

Search for `posthog-js`, `posthog-node`, `posthog` (Python), and any existing `posthog.init` or `Posthog(...)` construction. Note the host and token configuration, and where they come from.

An existing PostHog host is the most reliable signal of the project's region, and Step 2 needs the region. Record the exact host value you found, and whether it came from a literal or an environment variable.

Note separately whether session replay is enabled on the client, and whether `tracing_headers` is already configured on the client SDK. Step 4 needs both.

## 4. Where does the server learn who the user is?

This is the question the rest of the run turns on, so spend the most time here.

Find the point in a request's life where the server knows the authenticated user. That is usually a session lookup, an auth middleware, a decorator, or a helper like `auth()`, `getServerSession()`, `request.user`, or `current_user`. Note the file, the function, and the exact expression that yields a stable user id.

Prefer a stable unique id, the primary key from your auth system. Not an email, not a display name.

If the project has no concept of a user, say so plainly and remember it. Correlation will top out at the `session` tier via the header alone, or at `none`. That is a legitimate result.

Do not modify anything to make this easier. You are reading.

Continue to `2-install.md`.
