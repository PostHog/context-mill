# Mirror the report into a PostHog notebook

Once `posthog-setup-report.md` exists, mirror it into a shareable PostHog notebook
so the user has an in-app copy to link and comment on. The notebook is an extra
copy, not a replacement — keep the local report file in place.

Call `notebooks-create` through `posthog_exec` with a `title` (e.g.
`PostHog setup (wizard) – <repo name>`) and `content` set to a single markdown
node that wraps the report verbatim:

```json
{
  "title": "PostHog setup (wizard) – <repo name>",
  "content": { "type": "doc", "content": [
    { "type": "ph-markdown-notebook", "attrs": { "nodeId": "markdown-notebook-v2", "markdown": "<the full contents of posthog-setup-report.md>" } }
  ]}
}
```

Take the `short_id` from the response, build the URL as
`<host>/project/<project_id>/notebooks/<short_id>`, and emit it on its own line in
your final message with this exact marker so the wizard surfaces it:
`[NOTEBOOK_URL] <url>`. A URL only in prose, without the marker, is dropped.
