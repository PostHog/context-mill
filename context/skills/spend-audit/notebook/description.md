# Spend audit — the notebook

The notebook is the audit's report and the one output that always exists. The
`report` task creates it through `posthog_exec` before it writes the pull
request body and the result file, so both can link to it.

## Title

`Spend audit: <owner/repo>, <YYYY-MM-DD>`. Read the repository from the git
remote (`Read` `.git/config`, the `url` under `[remote "origin"]`), and fall
back to the project folder name. The date is today's, UTC.

## Sections, in this order

1. **Created by this audit.** Every dashboard and insight the run created,
   each linked by name, and the pull request when there is one (the product
   opens it after the run, so link the branch name `posthog/wizard-<run id>`
   only if your context names the run id; otherwise say "the pull request this
   run opens in <owner/repo>"). The user reviews this list and deletes what they
   do not want, so it must be complete.
2. **Your PostHog contact.** Only when your project context names an account
   owner: a card with their name, their email as a `mailto:` link, and one line
   that they can help apply these changes and review the bill. No title, no
   Slack channel. Without an account owner, skip the section.
3. **Summary.** The savings as a short list, largest volume first: title and
   the volume removed per month in its unit. No dollar total. The product
   prices it.
4. **Settings to change.** One block per `notebook` saving or unpriced
   finding that has a `setting`, ordered by volume removed, unpriced last. Each
   block: what to change (the exact `setting`), a link to
   `<app url><settings_path>`, the evidence, the tradeoff, and the effort.
5. **Code changes.** What the pull request changes and why, one bullet per
   applied finding with the file. Then the code changes for the user to make,
   one block each with the file, the change, the evidence and the tradeoff:
   every `pr` saving `apply-code-fixes` did not apply ("not applied: <reason>",
   or "no code fix task ran"), and every unpriced finding with a
   `code_change`. Only when both lists are empty: the single line "No code
   changes needed".
6. **Get more from what you pay for.** Each insight `value-insights` created,
   embedded, with one line on the question it answers and a link to its
   dashboard. Value findings with no insight (autocapture, a property
   suggestion) as plain lines.
7. **Checked, nothing to do.** The `passed` findings, one line each.

## Creating it

Which notebook tool exists depends on a feature flag, so check once:
`search notebooks-create`.

- **`notebooks-create` is listed.** Use it: it takes a rich document and can
  embed saved insights. `info notebooks-create` first. The content is a
  ProseMirror document:

  ```json
  {"type": "doc", "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Created by this audit"}]},
    {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [
      {"type": "text", "marks": [{"type": "link", "attrs": {"href": "<app url>/project/<id>/dashboard/412"}}], "text": "Spend audit: checkout"}
    ]}]}]},
    {"type": "paragraph", "content": [{"type": "text", "text": "Checkout funnel: how many checkouts complete within 14 days."}]},
    {"type": "ph-query", "attrs": {"nodeId": "<a fresh uuid>", "title": "Checkout funnel", "query": {"kind": "SavedInsightNode", "shortId": "aB3dE9fG"}}}
  ]}
  ```

  Every embed gets a short `attrs.title`. Headings are level 2. Lists are
  `bulletList` of `listItem` of `paragraph`.
- **Only `notebooks-create-markdown` is listed.** Create a markdown notebook
  with the same sections; link each insight instead of embedding it, since
  markdown notebooks hold no insight nodes.

Pass the whole document in one `call`, as one line of JSON with newlines and
quotes escaped. Never trim a section to make it parse; when the call fails on
size, create the notebook with the first sections and append the rest with
`notebooks-add-cell` or the update tool `info` shows.

The create response carries `short_id` and the URL. Put the URL in your final
message on its own line as `[NOTEBOOK_URL] <url>` so the wizard shows it, and
pass `short_id` to `publish_result`.

## Writing rules

- Plain language, sentence case, no jargon. The user is the person who pays
  the bill, not the engineer who wrote the integration.
- Every number has its unit and its window ("210,000 recordings in the last 30
  days"). Never a dollar figure.
- Links are absolute, built from the app URL in your context.
