# Asking the user through the wizard

`wizard_ask` puts structured questions in front of the user in the wizard's own UI
and waits for their answers. Use it whenever you would otherwise inline a question
in your text output — consent for a side effect, a choice between options, a value
only the user knows.

One call carries 1–8 questions:

```json
{
  "questions": [
    {
      "id": "subscribe",
      "prompt": "Set up a weekly email digest of the new dashboard?",
      "kind": "single",
      "options": [
        { "label": "Yes, email me weekly", "value": "yes" },
        { "label": "No thanks", "value": "no" }
      ]
    }
  ]
}
```

- `id` — unique per question; answers come back keyed by it.
- `kind` — `single` (pick one), `multi` (pick several), `text` (free entry).
  `single` and `multi` require at least one `{ label, value }` option.
- `required` — defaults to true.
- `sensitive` — `text` only. The answer goes into the wizard's secret vault and
  you receive `{ secretRef: "secret:..." }` instead of the raw string. Only
  wizard tools that accept refs (e.g. `set_env_values`) can resolve it — other
  MCP tools reject it, so write a secret to the env first if another tool needs it.

Batch related questions into a single call rather than asking one at a time —
sequential calls are for questions that genuinely depend on earlier answers, and
the wizard nudges then caps agents that dribble questions out. A cancelled or
timed-out overlay means the user declined: fall back gracefully — sensible
defaults, a deep link, or skipping the optional work with a note — and don't
re-ask. In a non-interactive run the tool returns an error saying so; do what it
instructs (proceed on defaults, or abort if the answer was truly required).

For consent to a side effect (an email, a schedule, anything that outlives the
run): one `single` yes/no question, the prompt saying in one line what you want to
create and what it does. A decline means skip that work entirely and say so in
what you hand off — not ask again in different words.
