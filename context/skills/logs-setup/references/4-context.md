---
title: Establish the identity context
next_step: 5-attach.md
---

# Step 4, make identity reachable at log time

The problem this step solves: the code that emits a log line is usually nowhere near the code that knows who the user is. A log statement four calls deep inside a service function has no idea a request is happening.

The fix is not to pass a user id down through every function signature. It is to bind identity once per request, somewhere ambient, so the log record can reach it later without anyone threading it through.

Work from the project wide decisions you recorded at the bottom of `.posthog-logs-plan.md`.

## Status

Emit these as you work.

```
[STATUS] Configuring client to send identity headers
[STATUS] Adding request identity context
[STATUS] Binding identity to the request
```

## Client side, send the headers

Skip this entirely if the project has no browser client, and note why on the plan.

`posthog-js` can attach the identity headers to outbound requests on its own. Set `tracing_headers` in the PostHog client initialization to your backend's hostname, and the SDK adds `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` to matching `fetch` and `XMLHttpRequest` calls.

Hostnames only, no protocol, no path, no port. Where the frontend and backend share an origin, that is the app's own hostname.

Do not hand-roll a fetch wrapper for this, and do not thread a session id through request bodies route by route. The installation docs demonstrate passing `sessionId` in a request body because it explains the idea in one snippet, but as an implementation it means touching every call site and it misses everything that does not go through the one function you wrapped. The config option covers the whole app.

If `tracing_headers` is already configured, confirm the backend hostname is in the list and leave it alone otherwise.

`sessionId` requires session replay to be enabled. If replay is off, the header will not carry a session and the project tops out at the `person` tier. Note that on the plan rather than trying to work around it.

Your prompt context states whether session replay is enabled on the PostHog project. Trust it over repo-local evidence: replay can be turned on from the snippet or from another repo entirely, so the absence of replay config in this codebase does not mean the product is off.

## Server side, bind identity to the request

Create the context the plan named. One new file, one mechanism, used everywhere.

The value you bind is a small object holding the distinct id and the session id. Resolve the distinct id at bind time, preferring the authenticated user id and falling back to the `X-POSTHOG-DISTINCT-ID` header. The header is client controlled, so a server known identity always wins.

**Next.js, App Router.** You may not need a store at all. `headers()` from `next/headers` is readable inside route handlers, server actions, and server components, so the attachment point in Step 5 can read the headers itself at emit time. That is the simplest thing that works, and it has no setup. Two constraints come with it: `headers()` is async on Next.js 15 and later, and it throws when called outside a request scope. Handle the throw by degrading to no attributes rather than letting it propagate, because a background job must not crash on a logging call.

Do not put this in `middleware.ts`. Next.js middleware runs on the Edge runtime, which is a different runtime from the one your route handlers and the OTel provider run in. Anything you store there is not visible to them.

**Next.js, Pages Router or a custom server.** `headers()` is not available. Use `AsyncLocalStorage` from `node:async_hooks`. Create the store in a module of its own, enter it at the top of the request path, and read from it in Step 5.

**Python.** Use a `contextvars.ContextVar` holding the identity, set from middleware. `ContextVar` is the right primitive because it is per task and per thread, so concurrent requests cannot read each other's identity. A module level global would leak identity across requests under any concurrency, which is worse than no correlation at all.

Set it where the framework gives you a request hook: Django middleware placed after `AuthenticationMiddleware`, a Flask `before_request` handler, or a FastAPI middleware. Reset the token when the request ends.

Django projects using the PostHog Python SDK may already have `PosthogContextMiddleware` installed, which extracts the same tracing headers for event capture. It is a good neighbour and a good model, but it feeds PostHog's event context rather than the logging pipeline. Add your context var alongside it, do not try to reach inside it.

## Rules

One mechanism for the whole project. Two competing context implementations is the outcome to avoid.

Do not modify individual log call sites here. Step 5 is the only step that touches how a record is produced.

Do not add authentication, and do not change how the project decides who a user is. You are reading an identity that already exists.

## Update the plan file

Edit `.posthog-logs-plan.md` and tick the `context` phase line.

```
- [x] context — <pass|warning|error> — <mechanism, and the file it lives in>
```

Use `warning` when the context exists but something limits it, replay disabled, or a client you could not configure. Use `error` only if you could not establish a context at all.

Continue to `5-attach.md`.
