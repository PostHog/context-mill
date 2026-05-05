# Web Analytics Doctor — Findings JSON Schema

The audit MUST emit `posthog-web-analytics-findings.json` at the project root with this exact shape. The wizard reads this file to render its structured findings screen — schema drift breaks the UX.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "auditedAt": "2026-05-04T15:30:00Z",
  "windowDays": 7,
  "expandedFromDefault": false,
  "findings": [ ... ],
  "passed": [ ... ],
  "skipped": [ ... ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | integer | Always `1` for this version. Bumped if the schema changes. |
| `auditedAt` | ISO 8601 string | UTC timestamp when the audit ran. |
| `windowDays` | integer | The analysis window actually used (7 or 30). |
| `expandedFromDefault` | boolean | `true` if you expanded from 7 days because the 7-day window was sparse. |
| `findings` | array | Each entry is one warning / info / critical finding. See below. |
| `passed` | array of strings | `checkId` of each check that ran cleanly with no findings. |
| `skipped` | array | Each entry: `{checkId, reason}`. Skipped because a precondition was missing (e.g. no app_urls). |

## Finding entry

```json
{
  "checkId": "partial_reverse_proxy",
  "severity": "warning",
  "title": "Mixed proxy configuration across hosts",
  "affected": ["hedgebox.net", "localhost:8010"],
  "evidence": [
    "hedgebox.net: 385.9k pageviews, 0 proxied",
    "localhost:8010: 1.0k pageviews, 100% proxied"
  ],
  "remediationUrl": "https://posthog.com/docs/advanced/proxy"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `checkId` | string | Stable enum from the table below. Snake_case. |
| `severity` | `"critical"` \| `"warning"` \| `"info"` | Per the rule in `checks.md`. Do not improvise. |
| `title` | string | Short human-readable headline (≤ 80 chars). |
| `affected` | array of strings | Host names, paths, or URLs the finding concerns. May be empty for project-wide findings. |
| `evidence` | array of strings | Concrete data points. Each ≤ 120 chars. Counts above 1,000 rounded to thousands (e.g. `385.9k`). No PII. |
| `remediationUrl` | string (URL) | The doc link from `checks.md` for this check. |

## Stable `checkId` values

These are the enum values the wizard knows about. Use them exactly:

- `partial_reverse_proxy` — Check 1
- `dark_authorized_urls` — Check 2
- `pageleave_coverage` — Check 3
- `web_vitals_coverage` — Check 4
- `duplicate_canonical_urls` — Check 5

If you add a new check in the future, pick a snake_case ID and update this table — the wizard's metadata map needs to know about it.

## Empty / healthy project

If no findings fire and no checks were skipped:

```json
{
  "schemaVersion": 1,
  "auditedAt": "2026-05-04T15:30:00Z",
  "windowDays": 7,
  "expandedFromDefault": false,
  "findings": [],
  "passed": [
    "partial_reverse_proxy",
    "dark_authorized_urls",
    "pageleave_coverage",
    "web_vitals_coverage",
    "duplicate_canonical_urls"
  ],
  "skipped": []
}
```

## Worked example

A run against a project with the partial-proxy and pageleave issues, where `dark_authorized_urls` was skipped because `app_urls` is empty:

```json
{
  "schemaVersion": 1,
  "auditedAt": "2026-05-04T15:30:00Z",
  "windowDays": 30,
  "expandedFromDefault": true,
  "findings": [
    {
      "checkId": "partial_reverse_proxy",
      "severity": "warning",
      "title": "Mixed proxy configuration across hosts",
      "affected": ["app.example.com", "go.example.com"],
      "evidence": [
        "app.example.com: 50.2k pageviews, 100% proxied",
        "go.example.com: 12.8k pageviews, 0 proxied"
      ],
      "remediationUrl": "https://posthog.com/docs/advanced/proxy"
    },
    {
      "checkId": "pageleave_coverage",
      "severity": "warning",
      "title": "Pageleave coverage low on go.example.com",
      "affected": ["go.example.com"],
      "evidence": ["12.8k pageviews, 1.2k pageleaves, ratio 0.094"],
      "remediationUrl": "https://posthog.com/docs/libraries/js#config"
    }
  ],
  "passed": [
    "web_vitals_coverage",
    "duplicate_canonical_urls"
  ],
  "skipped": [
    {"checkId": "dark_authorized_urls", "reason": "no app_urls configured"}
  ]
}
```

## Validation

The wizard validates this file with Zod on read. Common failures:

- Unknown `checkId` → wizard treats as known but uses a generic title.
- Unknown `severity` → wizard rejects the entire file and shows an error.
- Missing required fields → wizard rejects the entire file.

If you can't produce all required fields (e.g. a check failed to run), prefer the `skipped` array over emitting a malformed finding.
