# Key flow outcome scanner (classifier)

How each session went for **this** product's key flow: finished, left,
blocked, or confused. One tag per session turns into a trend the user can
watch, and a link to every session behind it. Create with
`vision-scanners-create`. You fill the blanks; the scaffold and the tags are
locked.

```jsonc
{
  // AGENT FILLS `name`, per the core naming rule - "Checkout outcome",
  // "Booking outcome".
  "name": "<name>",
  "scanner_type": "classifier",
  "scanner_config": {
    "prompt": "This product's key flow is {{FLOW}}. Classify how this session went for that flow. completed: the user finished it. abandoned: the user started it and left before finishing, with no visible error. blocked-by-error: an error, a broken screen, or a control that did nothing stopped the user. confused: the user hesitated, went back and forth, or searched for something they could not find before they finished or left. not-attempted: the user never started the flow. Pick the one tag that fits best, and say in one sentence what the user did and where they stopped.\n\n{{PRODUCT_CONTEXT}}",
    "tags": ["completed", "abandoned", "blocked-by-error", "confused", "not-attempted"],
    "multi_label": false
  },
  // Per tier, see below.
  "query": { "kind": "RecordingsQuery" },
  "sampling_rate": 1.0,
  "model": "gemini-3-flash-preview"
}
```

**`{{FLOW}}`** names this product's key completion flow from start to
finish, read out of the repo, as a noun phrase in the product's own words —
"booking a court, from picking a slot to the booking confirmation". It is a
plain fact under the same content rules as `{{PRODUCT_CONTEXT}}`. If the repo
shows no completion flow, skip this scanner and say why in your handoff: a
classifier about an invented flow misleads.

**Query and sampling, per the tiers in `replay-vision-scanners-core`.** Free
credit share: **0.4**.

- **No recordings yet, or low volume**: no filters — `{"kind":
  "RecordingsQuery"}`. `not-attempted` then tells the user how many sessions
  never reach the flow.
- **High volume**: a `visited_page` scope on the flow's first page, at
  `sampling_rate` 0.3, so most sessions it scans attempted the flow. Write
  the page as it appears in real recordings, per the page scope rules in
  `replay-vision-scanners-core`.

Re-run match phrase: `Classify how this session went for that flow`.
