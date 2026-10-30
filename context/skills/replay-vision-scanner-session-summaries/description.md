# Summary scanner (summarizer)

Plain-language session summaries in **this** product's vocabulary, so the
user sees the breadth of what scanners produce. Create with
`vision-scanners-create`. You fill three blanks; the scaffold around them is
locked, and the query stays unscoped on every tier.

```jsonc
{
  // AGENT FILLS `name`, per the core naming rule - "Shopper session
  // summaries", "Player session recaps".
  "name": "<name>",
  "scanner_type": "summarizer",
  "scanner_config": {
    "prompt": "Summarize what the user did in this session in two or three sentences: what they were trying to accomplish, the main things they did, and how the session ended. Use the product's own vocabulary: {{VOCABULARY}}.\n\n{{PRODUCT_CONTEXT}}"
  },
  "query": {
    "kind": "RecordingsQuery"
  },
  // Per tier, see below.
  "sampling_rate": 0.1,
  "model": "gemini-3-flash-preview"
}
```

**Sampling, per the tiers in `replay-vision-scanners-core`.** Free credit
share: **0.2**. With no recordings yet or low volume, it can summarize every
session. With high volume it keeps a 0.1 sample.

**`{{VOCABULARY}}`** is a short list of the nouns and verbs this product's
own UI uses for its key flows, read out of the repo — "courts, slots,
bookings; browsing courts, confirming a booking" — so summaries read like the
product, not like generic web analytics. Plain facts, under the same content
rules as `{{PRODUCT_CONTEXT}}`.

Re-run match phrase: `Summarize what the user did in this session`.
