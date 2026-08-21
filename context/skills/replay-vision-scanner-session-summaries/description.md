# Summary scanner (summarizer)

A rolling sample of plain-language session summaries in **this** product's
vocabulary, so the user sees the breadth of what scanners produce. Kept cheap
by a low sampling rate — never raise it during setup. Create with
`vision-scanners-create`. You fill three blanks; the scaffold around them is
locked, and the query stays unscoped.

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
  "sampling_rate": 0.1,
  "model": "gemini-3-flash-preview"
}
```

**`{{VOCABULARY}}`** is a short list of the nouns and verbs this product's
own UI uses for its key flows, read out of the repo — "courts, slots,
bookings; browsing courts, confirming a booking" — so summaries read like the
product, not like generic web analytics. Plain facts, under the same content
rules as `{{PRODUCT_CONTEXT}}`.

Re-run match phrase: `Summarize what the user did in this session`.
