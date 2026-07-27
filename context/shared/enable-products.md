Turn ON the PostHog products that self-driving reads from — **Session Replay**, **Error Tracking**, and **Support** (Conversations). A product left off just sits idle: the sources that consume it have nothing to read. This is a switch in PostHog, not a change in the repo.

Reach `products-enable` through the PostHog `exec` tool. Discover before you call — catalogs differ by project and by what the run's token is scoped for, so never assume the tool is there:

```
search product
info products-enable
```

Then enable all three in one call:

```
call products-enable { "products": ["session_replay", "error_tracking", "conversations"] }
```

It is idempotent and server-owned — you pass no settings, because the server owns each product's enable recipe. The response is `{ "results": { <product>: "enabled" | "already_enabled" } }`. Enabling Support also mints its widget token, leaving the widget itself off until a channel is connected. Record the per-product result.

**When `products-enable` isn't in the catalog.** That means this run's token was not granted `product_enablement:write`, the purpose-built scope the tool sits behind. Read the current state instead so the report can still tell the truth — `call project-get {"id": "@current"}`, where `session_recording_opt_in` is Session Replay, `autocapture_exceptions_opt_in` is exception capture, and `conversations_enabled` is Support — then record a follow-up saying the products need enabling from PostHog directly. Do **not** try to write those fields with `project-settings-update`: it requires the far broader `project:write`, which this run deliberately does not hold, and a 403 there tells you nothing new.

Refusals are expected and are not your failure. A tool absent from the catalog, a missing scope, or a user who isn't a project admin all end the same way: record the state you could read, raise a follow-up naming exactly what has to change, and carry on. Never abort, never reach for a raw REST call, and never invent a tool name.

Then check what the client does with those switches:

- **Web app** (this repo serves a browser frontend / loads `posthog-js`): the switch only takes effect if the client init doesn't override it. Find the `posthog.init(...)` call and check its options. `disable_session_recording: true` cancels the replay switch; `capture_exceptions: false` cancels the error-tracking one. If neither is set, the switch is enough.
- **Pure backend or mobile app** (no `posthog-js` reads the server config): the switch is inert until the SDK is configured in code. Record a follow-up noting that replay / exception capture for this platform needs SDK changes.
- **Support / Conversations** only produces tickets once an inbound channel (email / inbox / Slack) is connected. You are not connecting a channel here — record it as a next step for the user.

Record every result and any follow-up.
