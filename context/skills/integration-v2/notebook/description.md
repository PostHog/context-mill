# Mirror the report into a PostHog notebook

Once the setup report markdown is composed, mirror it into a shareable PostHog
notebook so the user has an in-app copy to link and comment on. No report file
is written to the project — the notebook and the `publish_handoff` call are how
the report reaches the user.

Use the exact report markdown you composed — the same content you pass to
`publish_handoff`, verbatim, not a summary of it. Create the notebook in a
single `notebooks-create-markdown` call through `posthog_exec` — that exact
tool name, no tool search — passing a `title` and the report as `markdown`.
The title becomes the notebook's leading `# heading`, so start the `markdown`
at the first section below it rather than repeating the title as an H1.

The exec command is `call notebooks-create-markdown` followed by the bare JSON
argument — no quotes around it, and the whole argument on one line with the
report's newlines and quotes escaped as normal JSON string encoding (`\n`,
`\"`, `\\`):

```
call notebooks-create-markdown {"title": "PostHog setup (wizard) – acme-shop", "markdown": "## Events captured\n\n| Event | Where |\n|---|---|\n| `user_signed_up` | `src/auth.ts` |\n\nInitialized with \"capture_exceptions: true\" in `src/posthog.ts`.\n"}
```

Wrong, and their exact errors:

```
call notebooks-create-markdown '{"title": ...}'   → "Unexpected token" (quotes reach the JSON parser)
call notebooks-create-markdown {"...": "line one
line two"}                                        → "Bad control character" (literal newline in a JSON string)
```

A full multi-page report goes through in one call when encoded this way — never
trim the report just to make it parse. If a correctly-encoded payload still
fails, split the transport: create the notebook with the first sections, then
append each remaining section as a markdown cell with `notebooks-add-cell`,
passing the `notebook_id` from the create response:

```
call notebooks-add-cell {"notebook_id": "AbCdEfGh", "cell_type": "markdown", "markdown": "## Next steps\n\n- Replace the `DISTINCT_ID` placeholder in `src/auth.ts`\n"}
```

The create response carries the notebook's `short_id` and its URL. Build the
link as `<posthog host>/project/<project id>/notebooks/<short_id>` and emit it
on its own line with the `[NOTEBOOK_URL]` marker so the wizard can show it on
the end screen.
