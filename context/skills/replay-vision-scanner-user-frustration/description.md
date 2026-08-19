# User frustration (monitor)

The user getting stuck. Gated on `$rageclick` — cheap and high-precision,
because here the gating event *is* the friction. Create with
`vision-scanners-create`. One blank: `{{PRODUCT_CONTEXT}}`. Everything else
is locked.

```jsonc
{
  "name": "User frustration",
  "scanner_type": "monitor",
  "scanner_config": {
    "prompt": "Watch this session for clear signs the user got stuck or frustrated: repeatedly clicking the same element, hammering a button that isn't responding, retrying the same action over and over, visibly hunting for something they can't find, or abandoning a flow partway through. Only flag genuine struggle you can see – not normal browsing or a single mis-click. For each: what they were trying to do, where they got stuck, and the URL.\n\n{{PRODUCT_CONTEXT}}"
  },
  "query": {
    "kind": "RecordingsQuery",
    "events": [{ "id": "$rageclick", "type": "events" }]
  },
  "sampling_rate": 1.0,
  "model": "gemini-3.6-flash"
}
```

**Leave the gate as the only filter.** Adding a URL scope is the change most
likely to collide with the Broken experiences monitor, which owns the *where*.
