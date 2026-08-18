# Broken experiences (monitor)

The product visibly breaking, on the flow where breaking costs the most.
Create with `vision-scanners-create`. Two blanks: the `query` and
`{{PRODUCT_CONTEXT}}`. Everything else is locked.

```jsonc
{
  "name": "Broken experiences",
  "scanner_type": "monitor",
  "scanner_config": {
    "prompt": "Watch this session for moments where the product visibly broke for the user: an error message or toast, a blank/white screen, content that failed to load, obviously broken layout, a spinner that never resolves, or a button/form/action that clearly did nothing or failed. Only flag issues that are unambiguous on screen and would actually matter to the user – ignore cosmetic nits and anything you're unsure about. For each: what the user was trying to do, what broke, and the URL.\n\n{{PRODUCT_CONTEXT}}"
  },
  "query": {
    // AGENT FILLS: this product's key completion flow + its immediate
    // predecessors, read out of the repo.
    "kind": "RecordingsQuery",
    "properties": [
      { "key": "$current_url", "value": "/checkout", "operator": "icontains", "type": "event" }
    ]
  },
  "sampling_rate": 0.5,
  "model": "gemini-3.6-flash"
}
```

The query filters on *where* the user is (URL). The frustration monitor
filters on *what they did* (`$rageclick`). **The two must never match the
same sessions** — if you widen one, narrow the other. And never gate this
monitor on `$exception`: that blinds it to silent breakage, the thing vision
is uniquely good at.
