# Statsig → PostHog mapping

This is the only source of truth the agent uses when deciding what a Statsig call site becomes in PostHog. If a call shape is not in this file, treat it as **ambiguous** (Step 3 marks it `warning`, Step 4 leaves the source unchanged, Step 7 lists it under Manual follow-ups).

A line marked _(ambiguous)_ does not have a clean 1:1 mapping; the agent must mark those `warning`, not improvise.

## Initialization

Initialization is **not** the responsibility of this skill — Step 2 already installed and initialized PostHog via the framework's integration skill. The agent removes the Statsig initialization call sites entirely and does not replace them with a new PostHog `init`; the integration skill's initialization stays put.

| Statsig | Action |
|---|---|
| `statsig.initialize(...)` / `Statsig.initialize(...)` | Remove the call. Remove its import if unused. |
| `new StatsigClient(...).initializeAsync()` | Remove the construction and initialization. |
| `<StatsigProvider sdkKey={…} user={…}>` / `<StatsigSynchronousProvider …>` | Remove the provider wrapper from the tree. The PostHog provider installed in Step 2 takes its place; do not add a second one. |
| Statsig server-SDK constructors (Python `statsig.initialize_client`, Ruby/Java/Go `Statsig.initialize`, etc.) | Remove the call. |

## Feature flags (gates)

PostHog flags use string keys, just like Statsig gates. **The agent does not translate gate names** — pass the gate name string through verbatim.

### Client side

| Statsig | PostHog |
|---|---|
| `statsig.checkGate('my-gate')` | `posthog.isFeatureEnabled('my-gate')` |
| `client.checkGate('my-gate')` | `posthog.isFeatureEnabled('my-gate')` |
| `useGate('my-gate').value` | `useFeatureFlagEnabled('my-gate')` (from `posthog-js/react`) |
| `useGate('my-gate')` (old SDK, returns boolean) | `useFeatureFlagEnabled('my-gate')` |
| `useFeatureGate('my-gate').value` | `useFeatureFlagEnabled('my-gate')` |
| `<Gate name='my-gate' fallback={X}>` | _(ambiguous)_ — render-prop component shape doesn't map 1:1; mark warning. |

### Server side

| Statsig | PostHog |
|---|---|
| `statsig.check_gate(user, 'my-gate')` (Python) | `posthog.feature_enabled('my-gate', distinct_id)` |
| `Statsig.check_gate(user, 'my-gate')` (Ruby) | `posthog.is_feature_enabled('my-gate', distinct_id)` |
| `Statsig.checkGate(user, 'my-gate')` (Java / Node server) | `posthog.isFeatureEnabled('my-gate', distinctId)` |
| `Statsig.CheckGate(user, 'my-gate')` (Go) | `posthogClient.IsFeatureEnabled(...)` (signature varies; consult the PostHog SDK for exact params) |

The Statsig server-side gate calls take a user object; PostHog takes a `distinct_id` and optional groups/properties. The agent extracts the `userID` from the Statsig user object as the PostHog `distinct_id`. Any `custom` properties on the Statsig user become `person_properties` in the PostHog call when the call site supplies them directly; if they're supplied at initialization-time only, mark the site `warning` — those properties now have to be set on the person via `posthog.identify(...)` (which is an instrumentation change, out of scope for this replacement skill).

## Dynamic configs and experiments

PostHog represents both Statsig `DynamicConfig` and Statsig `Experiment` as **multivariate feature flags**. The flag's payload is read with `getFeatureFlagResult`.

| Statsig | PostHog |
|---|---|
| `statsig.getConfig('my-config').get('key', fallback)` | `(posthog.getFeatureFlagResult('my-config')?.payload ?? {})['key'] ?? fallback` |
| `statsig.getConfig('my-config').getValue('key', fallback)` | Same as above. |
| `statsig.getExperiment('my-exp').get('variant', fallback)` | `posthog.getFeatureFlag('my-exp') ?? fallback` (variant key) **or** `posthog.getFeatureFlagResult('my-exp')?.payload?.['variant'] ?? fallback` if the call is reading a config-style payload key. The bundled reference defers to the call shape: a single-variant-string read is the former; a structured key read is the latter. |
| `useConfig('my-config').get('key', fallback)` | `(useFeatureFlagPayload('my-config') ?? {})['key'] ?? fallback` |
| `useExperiment('my-exp').get('variant', fallback)` | `useFeatureFlagVariantKey('my-exp') ?? fallback` |

## Layers

Statsig layers are a grouping primitive PostHog does not have a direct analog for.

| Statsig | PostHog |
|---|---|
| `statsig.getLayer('my-layer').get('param', fallback)` | _(ambiguous)_ — Statsig layers don't map 1:1 onto PostHog flags. Mark the site `warning`; the operator decides whether to model each layer parameter as its own flag/config payload. |
| `useLayer('my-layer')` | _(ambiguous)_ — same reason. |

## Event logging

PostHog event names live in the same string-keyed namespace Statsig used. **The agent does not translate event names**; it passes them through verbatim.

| Statsig | PostHog |
|---|---|
| `statsig.logEvent('event_name')` | `posthog.capture('event_name')` |
| `statsig.logEvent('event_name', 42)` | `posthog.capture('event_name', { value: 42 })` |
| `statsig.logEvent('event_name', 'foo')` | `posthog.capture('event_name', { value: 'foo' })` |
| `statsig.logEvent('event_name', value, { k: v })` | `posthog.capture('event_name', { value, k: v })` |
| `client.logEvent({ eventName: 'e', value: v, metadata: { k: 'v' } })` | `posthog.capture('e', { value: v, k: 'v' })` |

Statsig server-SDK event logging (`statsig.log_event(user, event)` Python, `Statsig.log_event(user, event)` Ruby/Java, etc.) becomes the equivalent server-side `posthog.capture(distinct_id, event_name, properties=…)` — exact argument order follows the PostHog server SDK for the language; the integration skill installed in Step 2 documents that for the framework involved.

## User updates

| Statsig | PostHog |
|---|---|
| `statsig.updateUser({ userID, email, custom })` | `posthog.identify(userID, { email, ...custom })` |
| `client.updateUserAsync({ userID, email, custom })` | `posthog.identify(userID, { email, ...custom })` |

If the Statsig call sets only a `userID` with no other properties, drop the properties object and call `posthog.identify(userID)`.

## Shutdown / flush

| Statsig | PostHog |
|---|---|
| `statsig.shutdown()` | _(ambiguous)_ — the right PostHog teardown depends on context: client-side typically needs no shutdown; server-side uses `posthog.shutdown()` (Node) / `posthog.shutdown()` (Python with the appropriate context). Mark `warning` unless the file is clearly a server-side teardown handler. |
| `statsig.flush()` | `posthog.flush()` server-side. _(ambiguous)_ on the client — no PostHog equivalent. |

## Import line cleanup

After all call sites in a file are rewritten, the file's Statsig imports become unused. The agent removes them in the same `Edit` that rewrote the last call site, e.g.:

- `import { Statsig } from 'statsig-js';` → remove the line.
- `import { useGate } from 'statsig-react';` → remove the line.
- `import { StatsigClient } from '@statsig/js-client';` → remove the line.

Do not touch unrelated imports in the file.
