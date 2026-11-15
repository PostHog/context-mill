---
title: Get the PostHog project token and host
---

- If the PostHog project token is missing, use the project token that the tool or CLI which started this setup already gave you (for example in its output or instructions).
- If it gave you none, call the PostHog MCP server's `projects-get` tool to list the projects. If more than one comes back, ask the user which project to use. Then call `project-get` with that project's `id` and read its `api_token`. Before you write the token, tell the user the project's `name` and confirm it is the one this app should send to. If the MCP server is not connected or not authenticated, ask the user for their PostHog project token instead.
- For the PostHog host URL: use the host that the tool or CLI which started this setup already gave you. If it gave you none, use the `api_host` field of the `project-get` response. If you still have no host from the calling tool, the MCP response, or existing project configuration, ask the user: "Are you on PostHog US Cloud or EU Cloud?" Do not assume US Cloud.
