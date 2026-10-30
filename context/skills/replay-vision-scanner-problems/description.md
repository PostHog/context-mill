# Problems scanner (monitor)

The product breaking for the user, or the user getting stuck, described in
**this** product's terms. One monitor covers both, so no session is scanned
twice for the same question. Create with `vision-scanners-create`. You fill
the blanks; the scaffold around them is locked.

```jsonc
{
  // AGENT FILLS `name`, per the core naming rule - "Checkout problems",
  // "Booking problems".
  "name": "<name>",
  "scanner_type": "monitor",
  "scanner_config": {
    "prompt": "Watch this session for moments where the product broke for the user or the user got stuck: an error message or toast, a blank screen, content that failed to load, a broken layout, a spinner that never resolves, a button or form that did nothing, repeated clicks on something that does not respond, retrying the same action, or hunting for something they cannot find. In this product that especially means: {{WATCH_FOR}}. Only flag problems that are clear on screen and would matter to the user – ignore cosmetic issues, a single mis-click, and anything you are unsure about. For each: what the user was trying to do, what went wrong, and the URL.\n\n{{PRODUCT_CONTEXT}}"
  },
  // Per tier, see below.
  "query": { "kind": "RecordingsQuery" },
  "sampling_rate": 1.0,
  "model": "gemini-3-flash-preview"
}
```

**`{{WATCH_FOR}}`** is three to six concrete problems a user of *this*
product can hit, read out of the repo, each visible on screen and in the
product's own vocabulary — "the slot picker showing no available courts",
"the payment step rejecting a valid card", "retrying the invite form after a
silent validation error". Facts, under the same content rules as
`{{PRODUCT_CONTEXT}}`.

**Query and sampling, per the tiers in `replay-vision-scanners-core`.** Free
credit share: **0.4**.

- **No recordings yet, or low volume**: no filters — `{"kind":
  "RecordingsQuery"}` — so every session can be watched.
- **High volume**: a `visited_page` scope on this product's key completion
  flow and its immediate predecessors, at `sampling_rate` 0.5. Write the
  pages as they appear in real recordings, per the page scope rules in
  `replay-vision-scanners-core`. If no real page belongs to the flow, or the
  scope matches no session, fall back to the busiest real product paths and
  say so in your handoff. Never gate it on an event, in particular not
  `$exception`: that hides the silent breakage vision is good at finding.

**Earlier runs of this command** created a separate breakage monitor and a
frustration monitor (`emits_signals: false`). A breakage monitor from an
earlier run (match phrase `moments where the product visibly broke for the
user`) is this brief's predecessor: update it in place into this brief, per
the core re-run rules. Leave a frustration monitor from an earlier run
(match phrase `clear signs the user got stuck or frustrated`) untouched, and
say in your handoff that it now overlaps this monitor, so the user can turn
it off.

Re-run match phrase: `moments where the product broke for the user or the user got stuck`.
