# Breakage scanner (monitor)

The product visibly breaking, on the flow where breaking costs the most —
written for **this** product, not a generic template. Create with
`vision-scanners-create`. You fill four blanks; the scaffold around them is
locked.

```jsonc
{
  // AGENT FILLS `name`, per the core naming rule - "Broken checkout",
  // "Booking failures".
  "name": "<name>",
  "scanner_type": "monitor",
  "scanner_config": {
    "prompt": "Watch this session for moments where the product visibly broke for the user: an error message or toast, a blank/white screen, content that failed to load, obviously broken layout, a spinner that never resolves, or a button/form/action that clearly did nothing or failed. In this product that especially means: {{WATCH_FOR}}. Only flag issues that are unambiguous on screen and would actually matter to the user – ignore cosmetic nits and anything you're unsure about. For each: what the user was trying to do, what broke, and the URL.\n\n{{PRODUCT_CONTEXT}}"
  },
  "query": {
    // AGENT FILLS: up to five regexes for this product's key completion
    // flow + its immediate predecessors, as real paths (see below).
    "kind": "RecordingsQuery",
    "properties": [
      {
        "type": "recording",
        "key": "visited_page",
        "operator": "regex",
        "value": ["^https?://[^/]+/checkout(/|\\?|#|$)", "^https?://[^/]+/cart(/|\\?|#|$)"]
      }
    ]
  },
  "sampling_rate": 0.5,
  "model": "gemini-3-flash-preview"
}
```

**`{{WATCH_FOR}}`** is what makes this scanner belong to this product: three
to six concrete failure modes read out of the repo, each observable on screen,
in the product's own vocabulary — "the slot picker showing no available
courts", "the payment step rejecting a valid card", "a booking confirmation
that never appears". Facts about what failure looks
like *here*, under the same content rules as `{{PRODUCT_CONTEXT}}`.

**The page scope.** `visited_page` matches every URL the recording itself
saw, so it works whatever events the project captures. Each value is one
regex over the full URL, and the values OR. Use five or fewer, anchor each on
the path (`^https?://[^/]+/booking(/|\?|#|$)`), write a dynamic segment as
`[^/]+`, and escape regex characters in literal path parts.

Ground the paths in real sessions when the project records any. Read the
pages people actually visit with `execute-sql`:

```sql
SELECT path(url) AS page, uniq(session_id) AS sessions
FROM session_replay_events
ARRAY JOIN all_urls AS url
WHERE start_time >= now() - INTERVAL 7 DAY
GROUP BY page
HAVING sessions >= 5
ORDER BY sessions DESC
LIMIT 100
```

Map the flow you found in the repo onto these real paths — a mount prefix, a
locale segment, or a public route that differs from the file name is common
— and write the real form. If no real path belongs to the flow, it is not
live yet: fall back to the busiest real product paths and say so in your
handoff. With no recordings yet, write the regexes from the repo's routes.
Either way, check the final query per `replay-vision-scanners-core` before
you create.

This monitor owns the *where* axis of the disjointness rule in
`replay-vision-scanners-core` — a page-scoped query, never an event gate. In
particular never gate it on `$exception`: that blinds it to silent breakage,
the thing vision is uniquely good at.

Re-run match phrase: `moments where the product visibly broke for the user`.
