# Spend audit — the result file

The result file is the machine-readable summary the product reads after the
run. It prices the savings from the user's billing, shows the top three, and
lists every created object for review and deletion. The `report` task writes
it with one `publish_result` call, always, last, after the notebook exists.

The product rejects a file with unknown fields, ids from another project, or an
`after` range above `before`. A rejected file drops the projection but keeps
the pull request and the notebook, so a wrong field costs the user the priced
view. Pass exactly these fields.

```json
{
  "version": 1,
  "notebook_short_id": "aB3dE9fG",
  "dashboard_ids": [412],
  "insight_ids": [9921, 9922],
  "savings": [
    {
      "id": "replay-minimum-duration",
      "title": "Skip recordings shorter than 10 seconds",
      "billing_type": "session_replay",
      "unit": "recordings",
      "before": 210000,
      "after": { "low": 88000, "high": 105000 },
      "evidence": "52% of the 210,000 recordings in the last 30 days were under 10 seconds",
      "tradeoff": "Short visits leave no replay to attach to a support ticket",
      "effort": "setting",
      "fixed_in": "notebook"
    }
  ],
  "value_items": [
    {
      "title": "Checkout funnel from checkout_started and order_completed",
      "reason": "Both events are captured (40,000 a month) but no insight used them",
      "insight_ids": [9921]
    }
  ],
  "checks_passed": ["Group analytics is in use", "No identify() loops found"]
}
```

## Field rules

- `version` is `1`.
- `notebook_short_id` is the `short_id` from the notebook create response.
- `dashboard_ids` and `insight_ids` hold every id this run created, from the
  `value-insights` handoff. Nothing the user made, nothing from another run.
  An id you did not see in a create response does not go in.
- `savings` holds every finding with `kind: saving`, mapped field for field
  from the findings record. `before` and `after` are monthly volumes in `unit`.
  `after.low <= after.high <= before`. `fixed_in` is `pr` only when
  `apply-code-fixes` reported that id as applied; a skipped finding is not a
  saving in this file (it is unpriced in the notebook).
- `value_items` holds every `kind: value` finding that got at least one
  insight, with those insight ids.
- `checks_passed` holds the `title` of every `kind: passed` finding.
- `unpriced` findings do not appear here. They live in the notebook only.
- No dollar amounts anywhere. No extra fields, not even `notes`.

Call `publish_result` once with this object. Its result tells you whether the
file was written; a refusal names the field that failed, so fix that field and
call again. Do not write the file yourself.
