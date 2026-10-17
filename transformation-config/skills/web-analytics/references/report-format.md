# Web Analytics Doctor — Report Format

Write the report to `posthog-web-analytics-report.md` at the project root.

## Required structure

```markdown
# PostHog Web Analytics Audit

_Audit run: <ISO timestamp>_
_Window analyzed: <e.g. last 7 days>_
_Project: <project name from project-get, no project ID — that's PII-adjacent>_

## Summary

- **Warnings:** N
- **Info:** N
- **Checks passed:** N
- **Checks skipped:** N

## Findings

### <Finding title>

- **Severity:** warning | info
- **Check:** <e.g. Partial reverse proxy>
- **Affected:** <host(s) or path(s)>
- **Evidence:**
  - <key fact 1, e.g. "example.com: 12,403 pageviews, 0 proxied">
  - <key fact 2>
- **Remediation:** <one-paragraph explanation, ending with the doc link>

(Repeat per finding, ordered: warnings first, then info.)

## Checks passed

- ✓ <Check name> — <one-line summary, e.g. "All hosts route consistently through reverse proxy">

## Checks skipped

- ✗ <Check name> — <reason, e.g. "No authorized URLs configured">

## Next steps

<2–3 sentences pointing the user at the most impactful finding to fix first, or a clean-bill-of-health note if there are no findings.>
```

## Tone & content rules

- **Be specific.** Cite host names and counts. "example.com: 12,403 pageviews, 0 proxied" beats "some hosts have proxy gaps."
- **Don't suggest code changes.** This is an audit. Point at the doc URL; the user's wizard or their own engineer handles remediation.
- **No PII.** Hosts, paths, and counts only. Never include user IDs, email addresses, distinct IDs, or specific session IDs in evidence.
- **Round counts** above 1,000 to thousands (12,403 → 12.4k) to avoid implying false precision.
- **No emojis** beyond the `✓` and `✗` markers in the passed/skipped lists.
- **Order findings** by severity (warnings before info), then by impact (highest event volume first).

## When there are zero findings

Replace the `Findings` section with:

```markdown
## Findings

No issues found. Web analytics setup looks healthy across all checks.
```

Still include `Checks passed` so the user can see what was verified.
