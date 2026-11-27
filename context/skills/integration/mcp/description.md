# Call PostHog MCP tools

Any step that creates something in PostHog — a dashboard, an insight, a notebook —
does it through the PostHog MCP. The one exception is the report notebook:
when the `publish_handoff` result names one, it already exists. Discover and inspect before you call; never guess
a tool name or the shape of its input.

{{> mcp-tool-calling}}
