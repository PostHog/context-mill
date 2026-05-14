---
next_step: 10-report.md
---

# Step 9 — Use case expansion & cross-sell

For each PostHog product, this step runs **two detectors in parallel** (is the PostHog product in use? is a competitor in use?) and classifies the project into one of four modes per product:

| Mode | Trigger | Audit signal |
|---|---|---|
| **cross-sell** | Competitor detected, PostHog product NOT used | The team is paying for a separate tool for this concern; PostHog covers it natively → unification pitch |
| **greenfield** | Nothing detected at all | No tool for this concern → adoption opportunity |
| **gap** | PostHog product in use, but missing coverage on recent / important surfaces | Already adopted; finish the job |
| **pass** | PostHog product in use, no obvious coverage gaps | Healthy — no action |

This step always runs (it does **not** ledger-gate). It writes one ledger entry per PostHog product audited, with `details` describing the mode + competitor (if any) + recommendation. Step 10 reads these and renders three sub-tables in the "Use case expansion & cross-sell" section of the final report.

**Read-only:** do not edit application source files.

Docs pointers (not exhaustive): [Product analytics](https://posthog.com/docs/product-analytics/capture-events), [Feature flags](https://posthog.com/docs/feature-flags/installation), [Error tracking](https://posthog.com/docs/error-tracking/installation), [LLM analytics](https://posthog.com/docs/ai-engineering/observability), [Session replay](https://posthog.com/docs/session-replay/installation), [Surveys](https://posthog.com/docs/surveys/installation), [Logs](https://posthog.com/docs/logs/installation), [Web analytics](https://posthog.com/docs/web-analytics).

## Status

Emit before dispatching subagents:

```
[STATUS] Detecting third-party tools and PostHog coverage
[STATUS] Auditing use case expansion & cross-sell
```

## Action

### Dispatch plan

Dispatch **8 Task subagents** total — one per PostHog product. Run them in **two batches** (4 + 4) to keep concurrency manageable. The Task IDs:

**Batch 1** (one message, 4 Task calls):
- `expansion-product-analytics`
- `expansion-error-tracking`
- `expansion-llm-observability`
- `expansion-session-replay`

**Batch 2** (one message, 4 Task calls):
- `expansion-feature-flags`
- `expansion-surveys`
- `expansion-logs`
- `expansion-web-analytics`

Wait for all Tasks in a batch to complete before dispatching the next batch. Do not interleave other tools between dispatch and waiting.

Each Task uses the same prompt structure (below). Substitute the product-specific values into the prompt template.

### Shared subagent prompt template

Use this template for each Task, filling in the bracketed values from the **Per-product detection map** below:

```
You are an audit subagent. Resolve exactly one ledger id: [TASK_ID].

You are auditing the project's coverage of PostHog's [PRODUCT_NAME] product. Run two detectors in parallel, then classify into ONE of four modes and resolve the ledger entry once.

## Detector A — PostHog [PRODUCT_NAME] in use?

Run a single Grep for the PostHog presence patterns:
[POSTHOG_PRESENCE_PATTERN]

Also check the dependency manifest (`package.json`, `requirements.txt`, `Gemfile`, etc.) for the relevant PostHog SDK package: [POSTHOG_PACKAGES].

PostHog [PRODUCT_NAME] is "in use" if any presence pattern matches OR the PostHog package is declared.

## Detector B — competitor in use?

Run a single Grep for competitor presence patterns:
[COMPETITOR_PATTERNS]

Also check the dependency manifest for competitor SDK packages: [COMPETITOR_PACKAGES].

Also check `.env*` files (read only env var NAMES; never log values) for competitor env vars: [COMPETITOR_ENV_VARS].

If any competitor signal matches, identify which competitor (use the first match's name).

## Classify

| PostHog in use? | Competitor detected? | Mode | Status |
|---|---|---|---|
| yes | (irrelevant) | run coverage gap check (see below) → `gap` if missing surfaces, else `pass` | `warning` (gap) or `pass` |
| no | yes | `cross-sell` | `warning` |
| no | no | `greenfield` | `suggestion` |

**For the `gap` mode** (PostHog already used): briefly inspect recent / important surfaces for missing coverage. Use the product-specific gap rule:
[GAP_RULE]

Stay conservative — only flag concrete `file:line` evidence, never speculative suggestions.

## Resolve

Call `mcp__wizard-tools__audit_resolve_checks` once with a single update for `[TASK_ID]`:

```json
{
  "updates": [
    {
      "id": "[TASK_ID]",
      "status": "<see classify table>",
      "file": "<file:line of the most representative finding, or empty>",
      "details": "<compact JSON, see schema below>"
    }
  ]
}
```

**`details` JSON schema:**

```json
{
  "mode": "cross-sell | greenfield | gap | pass",
  "posthog_present": true | false,
  "competitor": "<competitor name>" | null,
  "competitor_evidence": ["<file:line or package name>", ...],
  "gap_surfaces": ["<file:line>", ...],
  "pitch": "<one-line recommendation for the operator>"
}
```

Examples:
- cross-sell: `{"mode":"cross-sell","posthog_present":false,"competitor":"Sentry","competitor_evidence":["package.json: @sentry/react","src/main.tsx:13: Sentry.init"],"gap_surfaces":[],"pitch":"Replace Sentry with PostHog Error Tracking — unified with replays, flags, analytics."}`
- greenfield: `{"mode":"greenfield","posthog_present":false,"competitor":null,"competitor_evidence":[],"gap_surfaces":[],"pitch":"No error tracking detected. Adopt PostHog Error Tracking to ship before the next prod incident."}`
- gap: `{"mode":"gap","posthog_present":true,"competitor":null,"competitor_evidence":[],"gap_surfaces":["src/pages/Checkout.tsx:42"],"pitch":"PostHog Product Analytics is set up but the Checkout flow has no captures."}`
- pass: `{"mode":"pass","posthog_present":true,"competitor":null,"competitor_evidence":[],"gap_surfaces":[],"pitch":"Coverage looks comprehensive."}`

Return when the resolve_checks call completes. Do not write the audit report.
```

### Per-product detection map

Below are the eight product-specific values to plug into the template above. For each Task, the agent fills `[TASK_ID]`, `[PRODUCT_NAME]`, `[POSTHOG_PRESENCE_PATTERN]`, `[POSTHOG_PACKAGES]`, `[COMPETITOR_PATTERNS]`, `[COMPETITOR_PACKAGES]`, `[COMPETITOR_ENV_VARS]`, and `[GAP_RULE]`.

---

#### 1. `expansion-product-analytics` — PostHog Product Analytics

- **PostHog presence patterns:** `posthog\.capture\(|@posthog/(?:react|node|nextjs|js|web)|posthog-js|posthog-node|posthog-python|posthog-ruby|posthog-go|posthog-java|posthog-php|posthog-ios|posthog-android|posthog-flutter|posthog-react-native`
- **PostHog packages:** `posthog-js`, `posthog-node`, `posthog-python`, `posthog-ruby`, `posthog-go`, `posthog-java`, `posthog-php`, `@posthog/ai`, etc.
- **Competitor patterns:** `mixpanel\.(?:track|init|identify)|@mixpanel/|amplitude\.(?:track|init|getInstance)|@amplitude/|heap\.track|window\.heap\.|gtag\(|ga\(|@analytics/`
- **Competitor packages:** `mixpanel-browser`, `mixpanel`, `@amplitude/analytics-browser`, `@amplitude/analytics-node`, `amplitude-js`, `heap-analytics`, `@heap/analytics`, `analytics` (segment-only)
- **Competitor env vars:** `MIXPANEL_TOKEN`, `MIXPANEL_PROJECT_TOKEN`, `AMPLITUDE_API_KEY`, `AMPLITUDE_TOKEN`, `HEAP_ENV_ID`, `NEXT_PUBLIC_GA_ID`
- **Gap rule:** if PostHog Analytics is in use, Grep recent UI/route files (Glob `src/pages/**/*.tsx` or `app/**/*.tsx`) for files with **no** `posthog\.capture` calls. Cap to 3–5 examples in `gap_surfaces`.

---

#### 2. `expansion-error-tracking` — PostHog Error Tracking

- **PostHog presence patterns:** `captureException|\$exception|posthog\.captureException|posthog\.capture\(['"]\$exception`
- **PostHog packages:** `@posthog/error-tracking`, or just `posthog-js` / `posthog-node` (errors are part of the core SDK)
- **Competitor patterns:** `Sentry\.(?:init|captureException|captureMessage)|@sentry/|Bugsnag\.(?:start|notify)|@bugsnag/|Rollbar\.(?:init|error)|rollbar|Honeybadger\.(?:configure|notify)|airbrake\.notify`
- **Competitor packages:** `@sentry/browser`, `@sentry/node`, `@sentry/react`, `@sentry/nextjs`, `@sentry/python`, `sentry-sdk`, `@bugsnag/js`, `@bugsnag/node`, `rollbar`, `@rollbar/react`, `honeybadger-js`, `@airbrake/browser`, `@airbrake/node`
- **Competitor env vars:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `BUGSNAG_API_KEY`, `ROLLBAR_ACCESS_TOKEN`, `HONEYBADGER_API_KEY`, `AIRBRAKE_PROJECT_KEY`
- **Gap rule:** if PostHog Error Tracking is in use, Grep `catch\s*\(|throw new (?:Error|TypeError)` and check whether catch blocks emit `captureException`. Flag 2–3 catch blocks that don't report when sibling files do.

---

#### 3. `expansion-llm-observability` — PostHog LLM Observability

- **PostHog presence patterns:** `\$ai_generation|posthog\.ai|@posthog/ai|posthog-ai|withTracing\(|captureAi\(`
- **PostHog packages:** `@posthog/ai`
- **Competitor patterns:** `langfuse|@langfuse/|Helicone|@helicone/|LangSmith|@langchain/langsmith|smith\.langchain|braintrust|@braintrustdata/|phoenix\.trace|arize|@arizeai/`
- **Competitor packages:** `langfuse`, `langfuse-langchain`, `langfuse-python`, `helicone`, `@helicone/helpers`, `langsmith`, `braintrust`, `@braintrustdata/sdk`, `@arizeai/phoenix-client`
- **Competitor env vars:** `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`, `HELICONE_API_KEY`, `LANGCHAIN_API_KEY` (LangSmith), `LANGSMITH_API_KEY`, `BRAINTRUST_API_KEY`, `ARIZE_API_KEY`
- **Gap rule:** if PostHog LLM Obs is in use, Grep for LLM call sites (`openai\.|@ai-sdk|generateText|streamText|Anthropic|bedrock|langchain`) that don't wrap with the PostHog tracing pattern other files use. Cap to 3.

---

#### 4. `expansion-session-replay` — PostHog Session Replay

- **PostHog presence patterns:** `session_recording\s*[:=]\s*true|disable_session_recording\s*[:=]\s*false|sessionRecording|onSessionId|startSessionRecording|getSessionReplayUrl|get_session_replay_url`
- **PostHog packages:** included in `posthog-js`
- **Competitor patterns:** `LogRocket\.(?:init|identify)|@logrocket/|FS\.(?:init|identify)|@fullstory/|hj\(|window\.hj|Hotjar\.|clarity\(['"]`
- **Competitor packages:** `logrocket`, `@logrocket/react`, `@fullstory/browser`, `react-hotjar`, `@hotjar/browser`, `microsoft-clarity`, `@microsoft/clarity`
- **Competitor env vars:** `LOGROCKET_APP_ID`, `FULLSTORY_ORG_ID`, `HOTJAR_ID`, `CLARITY_PROJECT_ID`, `NEXT_PUBLIC_LOGROCKET_APP_ID`
- **Gap rule:** if PostHog Replay is in use AND error tracking exists in code, check whether errors attach `get_session_replay_url`. If `disable_session_recording: true` is set anywhere, surface that file:line.

---

#### 5. `expansion-feature-flags` — PostHog Feature Flags

- **PostHog presence patterns:** `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag|useFeatureFlagVariantKey|onFeatureFlags|reloadFeatureFlags|getFeatureFlagPayload|featureFlags\.`
- **PostHog packages:** included in `posthog-js` / `posthog-node`
- **Competitor patterns:** `LDClient\.|@launchdarkly/|launchdarkly-js-client-sdk|launchdarkly-node-server|splitio\.|@splitsoftware/|statsig\.(?:check|init)|statsig-js|@statsig/|optimizely\.|@optimizely/|flagsmith\.|@flagsmith/|growthbook|@growthbook/`
- **Competitor packages:** `launchdarkly-js-client-sdk`, `launchdarkly-node-server-sdk`, `@launchdarkly/node-server-sdk`, `@splitsoftware/splitio`, `statsig-js`, `statsig-node`, `@statsig/js-client`, `@optimizely/react-sdk`, `@optimizely/optimizely-sdk`, `flagsmith`, `flagsmith-nodejs`, `growthbook`, `@growthbook/growthbook`
- **Competitor env vars:** `LAUNCHDARKLY_SDK_KEY`, `LD_SDK_KEY`, `NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID`, `SPLIT_API_KEY`, `STATSIG_SERVER_KEY`, `STATSIG_CLIENT_KEY`, `OPTIMIZELY_SDK_KEY`, `FLAGSMITH_ENVIRONMENT_ID`, `GROWTHBUOOK_CLIENT_KEY`
- **Gap rule:** if PostHog Flags are in use, check for hardcoded `if (process.env.NODE_ENV === 'production')` or hardcoded environment toggles that could be flag-driven instead. Cap to 2.

---

#### 6. `expansion-surveys` — PostHog Surveys

- **PostHog presence patterns:** `getActiveMatchingSurveys|displaySurvey|renderSurvey|getSurveys\(|posthog\.getSurveys|SurveysAPI`
- **PostHog packages:** included in `posthog-js`
- **Competitor patterns:** `Typeform\.|@typeform/|tf\.|SurveyMonkey|surveymonkey\.|sprig\.|@sprig-technologies/|wootric\.|hotjar.*survey|qualaroo|getfeedback`
- **Competitor packages:** `@typeform/embed`, `react-typeform-embed`, `@sprig-technologies/sprig-browser`, `wootric`, `hotjar` (used for surveys feature)
- **Competitor env vars:** `TYPEFORM_API_TOKEN`, `SPRIG_ENVIRONMENT_ID`, `WOOTRIC_ACCOUNT_TOKEN`
- **Gap rule:** if PostHog Surveys are in use, check whether feedback/onboarding/checkout pages use them. Look at files matching `onboard|feedback|nps|review` patterns.

---

#### 7. `expansion-logs` — PostHog Logs

- **PostHog presence patterns:** `@posthog/otel|POSTHOG_LOG|@posthog/logs|posthog\.captureLog|posthog\.log|logsProcessor.*posthog|otel.*posthog`
- **PostHog packages:** `@posthog/otel`, `@posthog/logs`
- **Competitor patterns:** `datadog-logs|@datadog/browser-logs|dd-trace|dd_trace|sumologic|@sumologic/|Logtail|@logtail/|@logtail/browser|@logtail/node|betterstack|logz\.io|@logzio/|loggly\.|winston-loggly|pino-loki|@opentelemetry/exporter-otlp.*(?!posthog)`
- **Competitor packages:** `datadog-logs`, `@datadog/browser-logs`, `dd-trace`, `@sumologic/opentelemetry-sumologic-collector`, `@logtail/node`, `@logtail/browser`, `logz.io-logger`, `loggly-jslogger`, `winston-loggly-bulk`, `pino-loki`
- **Competitor env vars:** `DATADOG_API_KEY`, `DD_API_KEY`, `SUMO_HTTP_SOURCE`, `LOGTAIL_SOURCE_TOKEN`, `BETTER_STACK_SOURCE_TOKEN`, `LOGZIO_TOKEN`, `LOGGLY_TOKEN`
- **Gap rule:** if PostHog Logs are in use, Grep `console\.(log|error|warn|info)` in server / api directories and compare to sibling modules using the structured PostHog log sink. Cap to 3.

---

#### 8. `expansion-web-analytics` — PostHog Web Analytics

- **PostHog presence patterns:** `\$pageview|\$pageleave|posthog\.capture\(['"]?\$pageview` plus the analytics SDK (overlaps with product-analytics; Web Analytics is a feature of PostHog Analytics)
- **PostHog packages:** `posthog-js`
- **Competitor patterns:** `gtag\(|ga\(|google-analytics|GoogleAnalytics|plausible|@plausible/|fathom|@fathom/|trackPageview|matomo|window\.\_paq`
- **Competitor packages:** `react-ga4`, `react-ga`, `next-google-analytics`, `plausible-tracker`, `fathom-client`, `@fathom-client/`, `matomo-tracker`
- **Competitor env vars:** `NEXT_PUBLIC_GA_ID`, `GA_TRACKING_ID`, `GOOGLE_ANALYTICS_ID`, `PLAUSIBLE_DOMAIN`, `FATHOM_SITE_ID`, `MATOMO_URL`
- **Gap rule:** if PostHog Web Analytics is in use, check that `$pageview` and `$pageleave` are both captured (the latter is opt-in in many setups). Surface the init file if `capture_pageleave` is not enabled.

---

After all 8 Tasks resolve, continue to **`10-report.md`**. Do not run other tools between dispatch and the next step.
