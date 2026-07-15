---
title: How to call PostHog MCP tools
---

## How to call PostHog MCP tools

The PostHog MCP server exposes a single `exec` tool. Every PostHog operation is driven by a CLI-style command string passed in its `command` parameter — the tool may be namespaced by the host (`mcp__posthog__exec`, `mcp__posthog-wizard__exec`), but the command grammar is the same. Tool names and schemas are not predictable, so discover and inspect before you call.

**Grammar** — run in this order:

```text
exec({ "command": "search <regex>" })      # find tools by name/title/description; `tools` lists them all
exec({ "command": "info <tool_name>" })     # REQUIRED before every call — description + input schema
exec({ "command": "schema <tool_name> <field_path>" })  # drill into a field the schema flags with a `hint`
exec({ "command": "call <tool_name> <json_input>" })    # run the tool
```

Running `info <tool_name>` before `call <tool_name>` is mandatory, the same way you read a file before editing it. `info` returns the full schema for simple tools; for large ones it summarizes and attaches `hint` entries pointing at fields to drill into with `schema`. Dot-notation descends objects (`query.source`), array items (`series.0.properties`), and unions. Never guess the structure of a field that carries a hint — drill first.

Every PostHog tool goes through `exec` this way — there is no separate named tool to call directly. The inner tool names and JSON payloads below are what you pass to `call`.

**Errors** carry a suggestion and similar tool names — read it before retrying. If a name isn't found it may have been renamed; run `search <pattern>` or `tools` again to find the current one.
