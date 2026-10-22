---
title: Configure the posthog-node client for email
---

- Reuse the app's existing `posthog-node` client when it has one, and add `secretKey`. Keep `enableLocalEvaluation: false` unless the key also has `feature_flag:read` and the app uses local evaluation.
- When the project token or the host is not configured yet, get the token from the PostHog MCP `projects-get` tool (`api_token`). The host is `https://us.i.posthog.com` for US Cloud and `https://eu.i.posthog.com` for EU Cloud. Ask the person which one when you can't tell.
- When `host` is a reverse proxy or a self-hosted instance, also set `appHost` to the PostHog app URL, such as `https://us.posthog.com`. posthog-node never sends the secret key to a proxy, and without `appHost` the send fails with `missing_app_host`.
