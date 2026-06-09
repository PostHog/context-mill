# Capture events

Instrument the planned events with `posthog.capture('event_name', { ...props })`.

- Fire each capture on the real user action — the click or submit handler, the
  server action — not on render or page load.
- Add properties that make the event useful to analyze.
- Read the file before editing, and check the event is not already captured, so a
  re-run does not double-instrument.

Use the event plan from the previous step for the names, files, and actions.

## Reference

{references}
