# Mirror the report into a PostHog notebook

Once `posthog-setup-report.md` exists, mirror it into a shareable PostHog notebook
so the user has an in-app copy to link and comment on. The notebook is an extra
copy, not a replacement — keep the local report file in place.

First `Read` the finished `posthog-setup-report.md` (don't reconstruct it from
memory, and don't read it before the report step has written it). Then create the
notebook in a single `notebooks-create` call through `posthog_exec` — that exact
tool name, no tool search — with a `title` and `content` that wraps the report in
one `ph-markdown-notebook` node:

```json
{
  "title": "PostHog setup (wizard) – <repo name>",
  "content": { "type": "doc", "content": [
    { "type": "ph-markdown-notebook", "attrs": { "nodeId": "markdown-notebook-v2", "markdown": "<report contents>" } }
  ]}
}
```

The report goes in verbatim, but `markdown` is a JSON string field: build the
whole argument as one valid JSON value so the report's newlines and quotes are
escaped as normal JSON string encoding (`\n`, `\"`, `\\`). Never paste raw
multi-line text into the JSON, and never trim or summarize the report to make it
parse — if the call is rejected, the fix is always the escaping.

Take the `short_id` from the response, build the URL as
`<host>/project/<project_id>/notebooks/<short_id>`, and emit it on its own line in
your final message with this exact marker so the wizard surfaces it:
`[NOTEBOOK_URL] <url>`. A URL only in prose, without the marker, is dropped.
