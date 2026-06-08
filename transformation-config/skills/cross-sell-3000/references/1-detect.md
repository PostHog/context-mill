---
next_step: 2-baseline.md
---

# Step 1: Detect which PostHog products fit the codebase

This step scans the repository, classifies each PostHog product into a cross-sell mode, and writes the raw result to `/tmp/posthog-cross-sell-opportunities.json`. It does NOT rank, value, or classify-for-scaffolding (Step 3 owns that), does NOT plan implementations (Step 4), and does NOT edit any source file. Detection is read-only.

## Status

Emit:

```
[STATUS] Locating PostHog SDK
[STATUS] Detecting product fit
```

## Action

### a. Confirm PostHog is installed

`Glob` the dependency manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `composer.json`, `go.mod`, `*.csproj`, `pubspec.yaml`, …) and confirm at least one PostHog SDK is declared. Record the SDKs and the project's primary language/framework. If no PostHog SDK exists anywhere, emit `[ABORT] No PostHog SDK found` and stop.

### b. Run eight product detectors in parallel

Dispatch **eight `Agent` subagents** — one per PostHog product — in **two batches of four** (one message per batch, four `Agent` calls each). Wait for a batch to finish before dispatching the next. Do not run other tools between dispatch and collection.

**Batch 1:** `product-analytics`, `error-tracking`, `llm-observability`, `session-replay`
**Batch 2:** `feature-flags`, `surveys`, `logs`, `web-analytics`

Each subagent's `description`: `Detect <id> fit`. Each subagent's `prompt`, with `<>` filled from the **Detection map** below:

```
You are a cross-sell detection subagent. Assess the project's fit for PostHog <PRODUCT_NAME> and return one JSON object. Read-only — do not edit any file.

## Detector A — is PostHog <PRODUCT_NAME> already in use?
Run one Grep for: <POSTHOG_PRESENCE_PATTERN>
Also check the dependency manifest for: <POSTHOG_PACKAGES>
In use if any pattern matches OR the package is declared.

## Detector B — is a competitor in use?
Run one Grep for: <COMPETITOR_PATTERNS>
Check the manifest for competitor packages: <COMPETITOR_PACKAGES>
Check .env* files for competitor env var NAMES only (never read or log values): <COMPETITOR_ENV_VARS>
If any match, record the first competitor's name.

## Detector C — fit evidence
Grep for the code surfaces that signal this product would add value: <FIT_SIGNALS>
Collect up to 5 file:line hits as evidence.

## Classify mode
- PostHog in use + missing coverage on a surface Detector C found → mode "gap"
- PostHog in use + no obvious gap → mode "in-use" (healthy)
- PostHog NOT in use + competitor detected → mode "cross-sell"
- PostHog NOT in use + no competitor → mode "greenfield"

Stay conservative: only cite concrete file:line evidence, never speculation.

Return exactly this JSON (no prose):
{
  "id": "<TASK_ID>",
  "product": "<PRODUCT_NAME>",
  "mode": "cross-sell|greenfield|gap|in-use",
  "posthog_present": true|false,
  "competitor": "<name>"|null,
  "competitor_evidence": ["file:line or package", ...],
  "fit_evidence": ["file:line", ...]
}
```

### c. Aggregate

Collect the eight JSON objects. `Write` `/tmp/posthog-cross-sell-opportunities.json`:

```json
{
  "project_root": "<repo root>",
  "language": "<primary language/framework>",
  "sdks": { "posthog-js": "<version or range>", "posthog-node": "..." },
  "products": [ <the eight objects, verbatim> ]
}
```

## Detection map

Per-product values for the subagent prompt. Patterns are regex for `Grep`.

**`product-analytics` — Product Analytics**
- PostHog presence: `posthog\.capture\(|@posthog/(?:react|node|nextjs|js|web)|posthog-js|posthog-node|posthog-python|posthog-ruby|posthog-go`
- PostHog packages: `posthog-js`, `posthog-node`, `posthog-python`, `posthog-ruby`, `posthog-go`, `@posthog/ai`
- Competitor patterns: `mixpanel\.(?:track|init|identify)|amplitude\.(?:track|init)|@amplitude/|heap\.track|gtag\(|@analytics/`
- Competitor packages: `mixpanel-browser`, `mixpanel`, `@amplitude/analytics-browser`, `amplitude-js`, `heap-analytics`
- Competitor env vars: `MIXPANEL_TOKEN`, `AMPLITUDE_API_KEY`, `HEAP_ENV_ID`
- Fit signals: route/page components and key user actions (button onClick handlers, form submits, checkout/purchase paths) with no nearby `posthog.capture`.

**`error-tracking` — Error Tracking**
- PostHog presence: `captureException|\$exception|posthog\.captureException`
- PostHog packages: `posthog-js`, `posthog-node` (errors are core SDK)
- Competitor patterns: `Sentry\.(?:init|captureException)|@sentry/|Bugsnag\.|@bugsnag/|Rollbar\.|rollbar|Honeybadger\.`
- Competitor packages: `@sentry/browser`, `@sentry/node`, `@sentry/react`, `@sentry/nextjs`, `sentry-sdk`, `@bugsnag/js`, `rollbar`, `honeybadger-js`
- Competitor env vars: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `BUGSNAG_API_KEY`, `ROLLBAR_ACCESS_TOKEN`
- Fit signals: `catch\s*\(` blocks that swallow errors (empty, or only `console.error`/`console.log`) and are not reporting to any tracker.

**`llm-observability` — LLM Observability**
- PostHog presence: `\$ai_generation|@posthog/ai|posthog-ai|withTracing\(`
- PostHog packages: `@posthog/ai`
- Competitor patterns: `langfuse|@langfuse/|Helicone|@helicone/|LangSmith|langsmith|braintrust|@arizeai/`
- Competitor packages: `langfuse`, `helicone`, `langsmith`, `braintrust`, `@arizeai/phoenix-client`
- Competitor env vars: `LANGFUSE_PUBLIC_KEY`, `HELICONE_API_KEY`, `LANGSMITH_API_KEY`, `BRAINTRUST_API_KEY`
- Fit signals: LLM call sites — `openai\.|@ai-sdk|generateText|streamText|Anthropic|@anthropic-ai|langchain|bedrock` — not wrapped in any tracing.

**`session-replay` — Session Replay**
- PostHog presence: `session_recording|disable_session_recording|startSessionRecording|getSessionReplayUrl`
- PostHog packages: `posthog-js`
- Competitor patterns: `LogRocket\.|@logrocket/|FS\.(?:init|identify)|@fullstory/|window\.hj|Hotjar\.|clarity\(`
- Competitor packages: `logrocket`, `@fullstory/browser`, `react-hotjar`, `@hotjar/browser`, `@microsoft/clarity`
- Competitor env vars: `LOGROCKET_APP_ID`, `FULLSTORY_ORG_ID`, `HOTJAR_ID`, `CLARITY_PROJECT_ID`
- Fit signals: a web client SDK (`posthog-js`) present but `disable_session_recording: true`, or no replay config in init.

**`feature-flags` — Feature Flags**
- PostHog presence: `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag|getFeatureFlagPayload|onFeatureFlags`
- PostHog packages: `posthog-js`, `posthog-node` (flags are core SDK)
- Competitor patterns: `LDClient\.|@launchdarkly/|launchdarkly-|splitio|@splitsoftware/|statsig|@statsig/|@optimizely/|flagsmith|growthbook`
- Competitor packages: `launchdarkly-js-client-sdk`, `launchdarkly-node-server-sdk`, `@splitsoftware/splitio`, `statsig-js`, `statsig-node`, `@optimizely/react-sdk`, `flagsmith`, `growthbook`
- Competitor env vars: `LAUNCHDARKLY_SDK_KEY`, `LD_SDK_KEY`, `SPLIT_API_KEY`, `STATSIG_SERVER_KEY`, `OPTIMIZELY_SDK_KEY`, `FLAGSMITH_ENVIRONMENT_ID`
- Fit signals: hardcoded toggles that want to be flags — `process.env.*(?:FLAG|ENABLE|BETA)|if \(process\.env\.NODE_ENV`, beta/experimental conditional blocks, commented-out features.

**`surveys` — Surveys**
- PostHog presence: `getActiveMatchingSurveys|renderSurvey|posthog\.getSurveys`
- PostHog packages: `posthog-js`
- Competitor patterns: `Typeform|@typeform/|SurveyMonkey|sprig\.|@sprig-technologies/|wootric|qualaroo|delighted`
- Competitor packages: `@typeform/embed`, `react-typeform-embed`, `@sprig-technologies/sprig-browser`, `wootric`, `delighted`
- Competitor env vars: `TYPEFORM_API_TOKEN`, `SPRIG_ENVIRONMENT_ID`, `WOOTRIC_ACCOUNT_TOKEN`
- Fit signals: feedback / NPS / contact / onboarding surfaces — files matching `feedback|nps|contact|onboard|review|cancel` — that collect sentiment via custom forms.

**`logs` — Logs**
- PostHog presence: `@posthog/otel|@posthog/logs|posthog\.captureLog`
- PostHog packages: `@posthog/otel`, `@posthog/logs`
- Competitor patterns: `@datadog/browser-logs|dd-trace|@sumologic/|@logtail/|betterstack|@logzio/|loggly|pino-loki`
- Competitor packages: `@datadog/browser-logs`, `dd-trace`, `@logtail/node`, `@logtail/browser`, `winston`, `pino`, `bunyan`
- Competitor env vars: `DATADOG_API_KEY`, `DD_API_KEY`, `LOGTAIL_SOURCE_TOKEN`, `BETTER_STACK_SOURCE_TOKEN`
- Fit signals: server/API directories with ad-hoc `console\.(error|warn|log)` or a logger (`winston`/`pino`) and no structured log sink.

**`web-analytics` — Web Analytics**
- PostHog presence: `\$pageview|\$pageleave|capture_pageview|capture_pageleave`
- PostHog packages: `posthog-js`
- Competitor patterns: `gtag\(|google-analytics|GoogleAnalytics|plausible|fathom|matomo|window\._paq`
- Competitor packages: `react-ga4`, `react-ga`, `plausible-tracker`, `fathom-client`, `matomo-tracker`
- Competitor env vars: `NEXT_PUBLIC_GA_ID`, `GA_TRACKING_ID`, `PLAUSIBLE_DOMAIN`, `FATHOM_SITE_ID`, `MATOMO_URL`
- Fit signals: `posthog-js` present but pageview/pageleave not enabled (no `capture_pageview`, `defaults`, or `$pageview` capture).

## Output

`/tmp/posthog-cross-sell-opportunities.json` exists with all eight product objects.
