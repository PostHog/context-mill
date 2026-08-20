# Session summaries (summarizer)

A rolling sample of plain-language session summaries, so the user sees the
breadth of what scanners produce. Create with `vision-scanners-create`. One
blank: `{{PRODUCT_CONTEXT}}`. Everything else is locked.

```jsonc
{
  "name": "Session summaries",
  "scanner_type": "summarizer",
  "scanner_config": {
    "prompt": "Summarize what the user did in this session in two or three sentences: what they were trying to accomplish, the main things they did, and how the session ended. Use the product's own vocabulary.\n\n{{PRODUCT_CONTEXT}}"
  },
  "query": {
    "kind": "RecordingsQuery"
  },
  "sampling_rate": 0.1,
  "model": "gemini-3-flash-preview"
}
```

Kept cheap by the low sampling rate — **never raise it during setup**.
