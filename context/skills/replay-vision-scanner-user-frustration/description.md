# Frustration scanner (monitor)

The user getting stuck, described in **this** product's terms. Gated on
`$rageclick` — cheap and high-precision, because here the gating event *is*
the friction. Create with `vision-scanners-create`. You fill three blanks;
the scaffold around them is locked, and so is the query: **leave the
`$rageclick` gate as the only filter** unless this project has no rage
clicks (below) — this monitor owns the *what they did* axis of the
disjointness rule in `replay-vision-scanners-core`.

```jsonc
{
  // AGENT FILLS `name`, per the core naming rule - "Booking frustration",
  // "Editor rage clicks".
  "name": "<name>",
  "scanner_type": "monitor",
  "scanner_config": {
    "prompt": "Watch this session for clear signs the user got stuck or frustrated: repeatedly clicking the same element, hammering a button that isn't responding, retrying the same action over and over, visibly hunting for something they can't find, or abandoning a flow partway through. In this product that especially means: {{STUCK_MOMENTS}}. Only flag genuine struggle you can see – not normal browsing or a single mis-click. For each: what they were trying to do, where they got stuck, and the URL.\n\n{{PRODUCT_CONTEXT}}"
  },
  "query": {
    "kind": "RecordingsQuery",
    "events": [{ "id": "$rageclick", "type": "events" }]
  },
  "sampling_rate": 1.0,
  "model": "gemini-3-flash-preview"
}
```

**`{{STUCK_MOMENTS}}`** is three to six places a user of *this* product
realistically gets stuck, read out of the repo — "hammering a slot that is
already booked", "retrying the invite form after a silent validation error".
On-screen facts in the product's vocabulary, under the same content rules as
`{{PRODUCT_CONTEXT}}`.

**Check the gate first**, per `replay-vision-scanners-core`. When the project
records sessions but none in the window has a rage click (rage-click capture
off, or too little traffic), the gate leaves this scanner idle for good. Use
this fallback query and sampling rate instead. It watches active sessions at
a low rate and excludes the breakage monitor's pages, so the two monitors
stay disjoint:

```jsonc
{
  "query": {
    "kind": "RecordingsQuery",
    "properties": [
      { "type": "recording", "key": "active_seconds", "operator": "gt", "value": 30 },
      // The breakage monitor's `visited_page` regexes, from its handoff or
      // the scanner you just created. Omit this filter if it was skipped.
      { "type": "recording", "key": "visited_page", "operator": "not_regex", "value": ["<breakage regexes>"] }
    ]
  },
  "sampling_rate": 0.1
}
```

With no recordings yet, nothing can be checked: keep the `$rageclick` gate.
Say in your handoff which query you used and why.

Re-run match phrase: `clear signs the user got stuck or frustrated`.
