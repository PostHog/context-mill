---
next_step: 4-sources.md
---

# Step 3b — Enable products

Turn ON the PostHog products that Signals reads from — **Session Replay**, **Error Tracking**, and **Support** (Conversations) — so the sources you enable in the next step have data to read. A source with its product switched off just sits idle. This is a server-side flip with conservative defaults the server owns (you don't pass any settings); enabling Support also mints its widget token but leaves the widget itself off until a channel is connected.

This is distinct from step 4: here you turn the *products* on; step 4 wires up the *signal sources* that consume them.

## Status

Emit:

```
[STATUS] Enabling products
```

## Tools

The purpose-built `products-enable` tool is the preferred path, but it is **not yet published on the PostHog MCP** — check for it exactly once with `info products-enable` and branch on the result. Do not spend turns searching for it under other names. The fallback is `project-settings-update`, which flips the same products as raw project-settings fields.

## Do

1. Enable the products. Run `info products-enable` once:

   **If the tool exists**, call it:

```
{ "products": ["session_replay", "error_tracking", "conversations"] }
```

   It is idempotent and server-owned — the response is `{ "results": { <product>: "enabled" | "already_enabled" } }`. The run prompt's "Project state read at auth time" block tells you which are already ON, so you can leave those out (re-sending is harmless either way). Record the per-product result — the report lists it.

   **If the tool is not found** (the expected case today), call `project-settings-update` instead — PATCH semantics, only the fields you send change:

```
{ "id": "@current", "session_recording_opt_in": true, "autocapture_exceptions_opt_in": true, "conversations_enabled": true }
```

   Leave out any field the "Project state read at auth time" block shows as already ON. One difference from `products-enable`: this does not mint the Support widget token, so if Conversations was previously off, record a follow-up to finish Support setup in the PostHog UI even when the call succeeds.

   If either call is rejected for permissions, don't abort — that outcome is expected on some tokens: the wizard's token carries the narrow `product_enablement:write` scope minted for `products-enable`, not the broader project write access `project-settings-update` needs. Record a follow-up to enable the products from a project-admin account (Settings → Session replay / Error tracking / Conversations), and continue. **A rejection here does not block the next step** — enabling a product (this step) and enabling its signal source (step 4) are independent calls, so step 4 still switches the sources on. They simply sit idle until the products are on, then pick up data with no re-setup.

2. **Web app** (this repo serves a browser frontend / loads `posthog-js`): the server flip only takes effect if the client init doesn't override it. Find the `posthog.init(...)` call and check its options:
   - `disable_session_recording: true` cancels the replay enable → remove that option (or set it `false`).
   - `capture_exceptions: false` cancels the error-tracking enable → remove it (or set it `true`).
   - If neither is set, the server flip is enough — leave the init alone.
   - If you can't confidently locate or edit the init, don't guess — record a follow-up to check it manually.

3. **Pure backend or mobile app** (no `posthog-js` reads the server config): the flip is inert until the SDK is configured in code. Don't edit code here — record a follow-up noting that replay / exception capture for this platform needs SDK changes (a later setup will handle it).

4. **Support / Conversations** is now enabled, but it only produces tickets once an inbound channel (email / inbox / Slack) is connected. You're not connecting a channel here — just record it so step 7's report can give the user that next step.

Record every result and any follow-up — the report needs them. Then continue to the next step.
