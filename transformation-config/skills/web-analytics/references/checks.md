# Web Analytics Doctor — Audit Checks

Each check is independent. Run them in order; a failure in one does not block the others. Severity values are **fixed** — do not adjust them.

Time window: every query below uses `INTERVAL 7 DAY`. The pre-flight in `description.md` decides once whether to use 7 days or 30 days for the entire run; if it picked 30, swap `INTERVAL 7 DAY` for `INTERVAL 30 DAY` everywhere in this file before running.

---

## Check 1 — Partial reverse proxy

**What it detects:** Some hosts in the project route via a reverse proxy (so events survive ad blockers); others go directly to PostHog (where ad blockers can drop events). This is the support-case pattern: `example.com` proxied, `go.example.com` not.

**Query:**

```sql
SELECT
  properties.$host AS host,
  countIf(
    coalesce(properties.$lib_custom_api_host, '') = ''
    OR coalesce(properties.$lib_custom_api_host, '') LIKE '%i.posthog.com%'
    OR coalesce(properties.$lib_custom_api_host, '') LIKE '%posthog.com%'
  ) AS direct,
  countIf(
    coalesce(properties.$lib_custom_api_host, '') != ''
    AND coalesce(properties.$lib_custom_api_host, '') NOT LIKE '%posthog.com%'
  ) AS proxied,
  count() AS total
FROM events
WHERE event = '$pageview'
  AND timestamp > now() - INTERVAL 7 DAY
  AND properties.$host IS NOT NULL
  AND properties.$host != ''
GROUP BY host
HAVING total >= 100
ORDER BY total DESC
LIMIT 50
```

> **HogQL NULL gotcha:** in HogQL, `NULL != ''` evaluates to TRUE (not NULL as in standard SQL), so an unwrapped `properties.$lib_custom_api_host != ''` will silently match every row where the property is missing. Always wrap the property in `coalesce(..., '')` before comparing or using `LIKE`/`NOT LIKE`.

**Pass/fail rule:**
- **Warning** if any host has `proxied >= 1` AND any other host has `proxied = 0 AND direct >= 1`, AND the two hosts share a common registrable parent domain (see "Parent-domain heuristic" below).
- **Info** if `proxied` and `direct` hosts exist but parent domains differ — cross-environment mixing (e.g. dev vs prod) is plausible and shouldn't trigger a warning.
- Otherwise: pass.

**Parent-domain heuristic:** strip leading `www.`, then take the rightmost two dot-separated labels (so `go.example.com` and `app.example.com` both yield `example.com`). For these compound public suffixes, take the rightmost three labels instead: `co.uk`, `com.au`, `co.jp`, `co.nz`, `com.br`, `github.io`, `vercel.app`, `netlify.app`, `pages.dev`. This is a heuristic, not a public-suffix list — when in doubt, downgrade to **Info**.

**Evidence to include in finding:** the proxied host(s), the direct host(s), each with their event counts.

**Remediation:** https://posthog.com/docs/advanced/proxy

---

## Check 2 — Dark authorized URLs

**What it detects:** The user configured authorized URLs in PostHog (via project settings), but one or more of those URLs has zero events in the analysis window. This often means an ad blocker is silently eating events for that domain — or the SDK was never installed there.

**Step A — fetch authorized URLs:** call `mcp__posthog__project-get` and read `app_urls` from the response.

**Step B — query event volume per known host:**

```sql
SELECT
  properties.$host AS host,
  count() AS pageviews
FROM events
WHERE event = '$pageview'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY host
ORDER BY pageviews DESC
LIMIT 200
```

**Step C — compare:** for each entry in `app_urls`, parse out the hostname and check it against the query results in memory (do not issue one query per URL).

Define `total_project_pageviews` = sum of `pageviews` across every row returned by Step B (all hosts, not just authorized ones).

**Pass/fail rule:**
- **Warning** for each authorized URL whose hostname is absent from Step B's results entirely.
- **Warning** for each authorized URL whose `pageviews / total_project_pageviews < 0.01`, when at least one *other* authorized URL has `pageviews / total_project_pageviews >= 0.10`. (The peer threshold avoids firing on projects where every authorized URL is low-volume.)
- Skip this check if `app_urls` is empty (note in report).

**Evidence:** the dark host name, total project pageviews for context, and any peer authorized hosts with healthy volume.

**Remediation:** https://posthog.com/docs/web-analytics/faq

---

## Checks 3 & 4 — Pageleave and Web Vitals coverage per host

These two checks share a single combined query — run it once and apply both pass/fail rules to the result.

**What Check 3 detects:** A host emits `$pageview` but few or no `$pageleave` events. Pageleave drives bounce rate and session duration — without it, web analytics dashboards under-report engagement for that domain.

**What Check 4 detects:** A host has pageviews but no `$web_vitals` events, meaning LCP/CLS/INP performance metrics aren't captured.

**Combined query:**

```sql
SELECT
  properties.$host AS host,
  countIf(event = '$pageview') AS pageviews,
  countIf(event = '$pageleave') AS pageleaves,
  countIf(event = '$web_vitals') AS web_vitals,
  round(countIf(event = '$pageleave') / nullif(countIf(event = '$pageview'), 0), 3) AS pageleave_ratio
FROM events
WHERE event IN ('$pageview', '$pageleave', '$web_vitals')
  AND timestamp > now() - INTERVAL 7 DAY
  AND properties.$host IS NOT NULL
  AND properties.$host != ''
GROUP BY host
HAVING pageviews >= 100
ORDER BY pageviews DESC
LIMIT 50
```

**Check 3 — Pageleave pass/fail rule:**
- **Info** for any host with `pageleaves = 0` (and `pageviews >= 100`, which the `HAVING` already enforces).
- **Warning** for any host with `pageleaves > 0 AND pageleave_ratio < 0.5` (less than half as many pageleaves as pageviews). Mutually exclusive with the Info rule above — never emit both for the same host.
- **Evidence:** host, pageview count, pageleave count, ratio.
- **Remediation:** https://posthog.com/docs/libraries/js#config — set `capture_pageleave: true`.

**Check 4 — Web Vitals pass/fail rule:**
- **Info** (not warning — many setups intentionally skip vitals) for any host with `web_vitals = 0`.
- **Evidence:** host, pageview count.
- **Remediation:** https://posthog.com/docs/web-analytics/web-vitals

Emit Check 3 and Check 4 as separate findings (with their own `checkId` values per `findings-schema.md`) even though they came from one query.

---

## Check 5 — Duplicate canonical URLs across hosts

**What it detects:** The same path (e.g. `/pricing`) is tracked under multiple `$host` values. This often means you have a marketing site and an app subdomain that both render the same content but get separate analytics — a sign that one is leaking or that proxy/canonical config is inconsistent.

**Query:**

```sql
SELECT
  properties.$pathname AS path,
  groupUniqArray(properties.$host) AS hosts,
  count() AS pageviews
FROM events
WHERE event = '$pageview'
  AND timestamp > now() - INTERVAL 7 DAY
  AND properties.$host IS NOT NULL
  AND properties.$host != ''
  AND properties.$pathname IS NOT NULL
  AND properties.$pathname != ''
GROUP BY path
HAVING length(hosts) >= 2 AND pageviews >= 100
ORDER BY pageviews DESC
LIMIT 25
```

**Pass/fail rule:**
- **Info** if any path appears under ≥ 2 hosts with combined `pageviews >= 100`.

**Evidence:** the path, the list of hosts, combined pageview count.

**Remediation:** https://posthog.com/docs/web-analytics/faq — review `$current_url` / `$host` capture, confirm reverse proxy and canonicalization across all domains.

---

## Severity ladder

| Severity | When to use |
| --- | --- |
| `critical` | Reserved — none of the current checks emit critical. Future checks may. |
| `warning` | Active misconfiguration likely causing data loss. Action required. |
| `info` | Possibly intentional, but worth surfacing. The user decides. |
