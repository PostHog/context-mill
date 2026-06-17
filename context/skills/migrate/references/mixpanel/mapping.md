# Mixpanel → PostHog mapping

This is the only source of truth the agent uses when deciding what a Mixpanel call site becomes in PostHog. If a call shape is not in this file, treat it as **ambiguous** (Step 3 marks it `warning`, Step 4 leaves the source unchanged, Step 7 lists it under Manual follow-ups).

A line marked _(ambiguous)_ does not have a clean 1:1 mapping; the agent must mark those `warning`, not improvise.

## PostHog SDK quick reference

The agent does not WebFetch PostHog docs. This section gives the exact PostHog method signatures the per-call tables below assume. Step 2's integration skill is responsible for the import + `init` lines; the agent uses the global `posthog` symbol (or whatever name the integration skill bound) at every call site.

### Capture an event

| SDK | Signature |
|---|---|
| `posthog-js` (browser, RN) | `posthog.capture(event: string, properties?: Record<string, any>)` |
| `posthog-node` | `posthog.capture({ distinctId: string, event: string, properties?: object, groups?: object })` (single object arg) |
| `posthog-python` | `posthog.capture(distinct_id, event, properties=None, groups=None)` (positional) |
| `posthog-ruby` | `posthog.capture(distinct_id:, event:, properties: {}, groups: {})` (kwargs) |
| `posthog-java` | `posthog.capture(distinctId, event, Map<String, Object> properties)` |
| `posthog-go` | `client.Enqueue(posthog.Capture{ DistinctId, Event, Properties posthog.Properties, Groups posthog.Groups })` |
| `posthog-php` | `PostHog::capture(['distinctId' => ..., 'event' => ..., 'properties' => [...]])` |
| `PostHog` (Swift/iOS) | `PostHogSDK.shared.capture("event", properties: ["k": "v"])` |
| `posthog-android` | `PostHog.capture("event", properties: mapOf("k" to "v"))` |
| `posthog_flutter` | `await Posthog().capture(eventName: 'event', properties: { 'k': 'v' })` |

### Identify a user

| SDK | Signature |
|---|---|
| `posthog-js` (browser, RN) | `posthog.identify(distinctId: string, setProps?: object, setOnceProps?: object)` |
| `posthog-node` | `posthog.identify({ distinctId, properties? })` |
| `posthog-python` | `posthog.identify(distinct_id, properties=None)` |
| `posthog-ruby` | `posthog.identify(distinct_id:, properties: {})` |
| `posthog-java` | `posthog.identify(distinctId, Map<String, Object> properties)` |
| `posthog-go` | `client.Enqueue(posthog.Identify{ DistinctId, Properties posthog.Properties })` |
| `posthog-php` | `PostHog::identify(['distinctId' => ..., 'properties' => [...]])` |
| Swift / Android / Flutter | `posthog.identify("distinct_id", userProperties: [...], userPropertiesSetOnce: [...])` (kw arg names vary slightly per SDK) |

### Set person properties (client side)

| SDK | Signature |
|---|---|
| `posthog-js` (browser, RN) | `posthog.setPersonProperties(setProps?: object, setOnceProps?: object)` — at least one arg must be provided. |
| Swift / Android / Flutter | Fold properties into the next `identify()` or `capture()` via `$set` payload. |

Server SDKs have no dedicated `setPersonProperties` — write `$set` / `$set_once` directly into a `capture` call's properties.

### Group analytics

| SDK | Signature |
|---|---|
| `posthog-js` (browser, RN) | `posthog.group(groupType: string, groupKey: string, properties?: object)` |
| `posthog-node` | `posthog.groupIdentify({ groupType, groupKey, properties?, distinctId? })` |
| `posthog-python` | `posthog.group_identify(group_type, group_key, properties=None)` |
| `posthog-ruby` | `posthog.group_identify(group_type:, group_key:, properties: {})` |
| `posthog-java` | `posthog.groupIdentify(groupType, groupKey, Map<String, Object> properties)` |
| `posthog-go` | `client.Enqueue(posthog.GroupIdentify{ Type, Key, Properties })` |
| `posthog-php` | `PostHog::groupIdentify(['groupType' => ..., 'groupKey' => ..., 'properties' => [...]])` |
| Swift / Android | `PostHogSDK.shared.group(type: "...", key: "...", groupProperties: [...])` |

To **associate** an event with a group (without setting group properties), pass `$groups` in the event properties (browser) or the `groups`/`Groups` argument the SDK exposes (server).

### Super properties (client side only)

| SDK | Signature |
|---|---|
| `posthog-js` (browser, RN) | `posthog.register(props: object)`, `posthog.register_once(props: object)`, `posthog.unregister(key: string)` |

Server SDKs have no super-properties API — see the mapping rows for the fallback.

### Reset, opt-out, flush

| SDK | Signature |
|---|---|
| `posthog-js` (browser, RN) | `posthog.reset(resetDeviceId?: boolean)`, `posthog.opt_in_capturing()`, `posthog.opt_out_capturing()`, `posthog.has_opted_out_capturing(): boolean` |
| `posthog-node` | `await posthog.shutdown()` (also flushes), `await posthog.flush()`. No first-class opt-out toggle; the agent honors opt-out by guarding the `capture` call or setting the `disabled` init flag. |
| `posthog-python` | `posthog.shutdown()`, `posthog.flush()`. Opt-out: set `posthog.disabled = True/False`. |
| `posthog-ruby` | `posthog.shutdown`, `posthog.flush`. |
| `posthog-java` | `posthog.shutdown()`. |
| `posthog-go` | `client.Close()` (flushes and closes). |
| `posthog-php` | Flushes on `__destruct`; no explicit shutdown. |

### Alias

PostHog auto-merges anonymous → identified on the first `posthog.identify(distinctId)` call. `posthog.alias(aliasId, distinctId)` exists in `posthog-js` but is reserved for the rare case where a user has two distinct IDs you want to *both* point at the same person — it is **not** the right translation for `mixpanel.alias()`. The mapping below collapses every `mixpanel.alias` to a single `posthog.identify`.

## PostHog reserved properties and event names

The agent uses these PostHog conventions in the per-call tables below. They are PostHog-internal — the agent passes them through as-is in property objects.

| Key | Where it appears | Meaning |
|---|---|---|
| `$set` | Inside `properties` on `capture` or as the second arg to client-side `identify` | Overwrite person properties with the given values. |
| `$set_once` | Same | Set person properties only if not already set. |
| `$unset` | Inside `properties` on a `capture('$unset', ...)` call | Remove the listed person property keys. |
| `$groups` | Inside `properties` on `capture` | Associate this event with the given groups (`{ groupType: groupKey }`). |
| `$pageview` | Event name auto-emitted by PostHog's `posthog-js` autocapture | Page view. Do not emit manually unless autocapture is disabled. |
| `$identify` | Event name PostHog emits internally on `identify()`; never set manually. | — |
| `$set` event | Event name (`'$set'`) used to set person properties **without** an associated user action. Useful from server SDKs. | — |

PostHog **person properties** are unprefixed (`email`, `name`, etc.) — strip Mixpanel's leading `$` when translating (`$email` → `email`).

## Initialization

Initialization is **not** the responsibility of this skill — Step 2 already installed and initialized PostHog via the framework's integration skill. The agent removes the Mixpanel initialization call sites entirely and does not replace them with a new PostHog `init`; the integration skill's initialization stays put.

| Mixpanel | Action |
|---|---|
| `mixpanel.init('TOKEN', { ... })` (browser) | Remove the call. Remove the inline CDN snippet IIFE if present. Remove the import if unused. |
| `Mixpanel.init('TOKEN', { ... })` (Node) | Remove the call and the `const mp = ...` assignment. |
| `Mixpanel('TOKEN')` (Python) / `Mixpanel::Tracker.new('TOKEN')` (Ruby) | Remove the constructor. |
| `Mixpanel.initialize(token: ...)` (Swift) / `MixpanelAPI.getInstance(...)` (Android) | Remove the constructor. |
| Inline CDN snippet IIFE (`(function (f, b) { if (!b.__SV) ...`) | Remove the entire script block from the HTML template. |

The `init` options object (`autocapture`, `track_pageview`, `record_sessions_percent`, `record_heatmap_data`, etc.) is **dropped wholesale**, not translated. PostHog's defaults already cover autocapture, page views, and replay; the integration skill installed in Step 2 owns the equivalent options. Do not disable PostHog defaults to mirror a narrower Mixpanel config.

## Event tracking

PostHog event names live in the same string-keyed namespace Mixpanel used. **The agent does not translate event names** — pass them through verbatim. Same for property keys.

### Client side (browser, mobile, React Native)

| Mixpanel | PostHog |
|---|---|
| `mixpanel.track('event_name')` | `posthog.capture('event_name')` |
| `mixpanel.track('event_name', { k: v })` | `posthog.capture('event_name', { k: v })` |
| `mixpanel.track_pageview()` / `mixpanel.track_pageview({ ... })` | Remove the call. PostHog's `capture_pageview` default already handles this; do not disable it. _(If the original passed custom properties that have no other capture site, set those via `posthog.register({...})` instead. Mark `warning` if the call clearly carries non-pageview side data.)_ |
| `mixpanel.track_links('a.cta', 'CTA clicked')` | _(ambiguous)_ — PostHog autocapture catches link clicks but does not honor a named-event override. Mark `warning`; the operator decides whether to keep autocapture or add a manual `posthog.capture` listener. |
| `mixpanel.track_forms('#signup', 'Signup submitted')` | _(ambiguous)_ — same reason as `track_links`. |
| `mixpanel.time_event('event_name')` | _(ambiguous)_ — PostHog has no paired-timer API. Mark `warning`; the operator decides whether to compute the duration manually and pass it as a property. |
| `mixpanel.track_with_groups('e', { ... }, { company: 'co_123' })` | `posthog.capture('e', { ..., $groups: { company: 'co_123' } })` |

### Server side

The agent extracts the `distinct_id` from the Mixpanel call's first argument (or from the `distinct_id` property in Node's options object) and uses it as the PostHog `distinct_id`. Property objects pass through unchanged.

| Mixpanel | PostHog |
|---|---|
| Node: `mp.track('e', { distinct_id, ...props })` | `posthog.capture({ distinctId: distinct_id, event: 'e', properties: { ...props } })` |
| Python: `mp.track(distinct_id, 'e', props)` | `posthog.capture(distinct_id, 'e', props)` |
| Ruby: `tracker.track(distinct_id, 'e', props)` | `posthog.capture(distinct_id: distinct_id, event: 'e', properties: props)` |
| Java: `messageBuilder.event(distinct_id, 'e', props)` + `mixpanel.deliver(...)` | `posthog.capture(distinctId, 'e', properties)` — `posthog-java` exposes capture directly on the `PostHog` instance (`Map<String, Object>` for properties). The Mixpanel builder + deliver pattern collapses to a single call. |
| Go: `client.Track(ctx, []*Event{ ... })` | `posthogClient.Enqueue(posthog.Capture{ DistinctId: ..., Event: ..., Properties: ... })` |
| PHP: `$mp->track('e', [ 'distinct_id' => ..., ...props ])` | `PostHog::capture([ 'distinctId' => ..., 'event' => 'e', 'properties' => [...] ])` |

## Super properties (client SDKs only)

| Mixpanel | PostHog |
|---|---|
| `mixpanel.register({ k: v, ... })` | `posthog.register({ k: v, ... })` |
| `mixpanel.register_once({ k: v, ... })` | `posthog.register_once({ k: v, ... })` |
| `mixpanel.unregister('key')` | `posthog.unregister('key')` |

Server SDK super-property calls (if any custom wrapper exists): _(ambiguous)_ — there is no native server-side `register` in PostHog. Mark `warning`.

## Identity

PostHog auto-merges the anonymous session into the identified user on the first `identify()` call. Mixpanel's separate `alias` step is therefore redundant in PostHog and collapses to a single `posthog.identify()`.

| Mixpanel | PostHog |
|---|---|
| `mixpanel.identify('user_123')` | `posthog.identify('user_123')` |
| `mixpanel.identify('user_123', { $email: '...', name: '...' })` | `posthog.identify('user_123', { email: '...', name: '...' })` — strip the leading `$` from Mixpanel reserved property keys (e.g., `$email` → `email`). |
| `mixpanel.alias('user_123', existingId?)` | `posthog.identify('user_123')` — PostHog merges automatically; do not also emit `posthog.alias()`. |
| `mixpanel.reset()` | `posthog.reset()` |

Server SDKs do not have an `identify` step — identity is supplied inline to every `track` / `capture` call. The agent does not introduce a server-side `posthog.identify()` unless Step 3 already discovered an explicit identity-binding call site.

## People / profile properties

PostHog stores profile properties on the person record via the `$set` / `$set_once` / `$unset` event payloads. The cleanest replacement depends on whether the call has a `distinct_id` in scope.

### Client side

| Mixpanel | PostHog |
|---|---|
| `mixpanel.people.set({ k: v, ... })` | `posthog.setPersonProperties({ k: v }, /* set_once */ undefined)` — or, when the call site already had an `identify` immediately before, fold properties into that call's `$set`. |
| `mixpanel.people.set_once({ k: v, ... })` | `posthog.setPersonProperties(/* set */ undefined, { k: v })` |
| `mixpanel.people.unset(['k1', 'k2'])` | `posthog.capture('$unset', { $unset: ['k1', 'k2'] })` |
| `mixpanel.people.increment('count')` / `.increment('count', 5)` | _(ambiguous)_ — PostHog has no first-class numeric increment on person properties. Mark `warning`; the operator decides whether to refactor to a captured event with a numeric property. |
| `mixpanel.people.append('list_prop', value)` | _(ambiguous)_ — no PostHog list-append for person properties. |
| `mixpanel.people.union('set_prop', [values])` | _(ambiguous)_ — same. |
| `mixpanel.people.track_charge(amount, props?)` | _(ambiguous)_ — Mixpanel's revenue model has no direct PostHog mirror. Mark `warning`; the operator decides whether to capture a `purchase`-style event with a numeric `revenue` property and consume it via PostHog revenue analytics. |
| `mixpanel.people.clear_charges()` | _(ambiguous)_ — no equivalent. |
| `mixpanel.people.delete_user()` | _(ambiguous)_ — points operator at PostHog's GDPR delete API; do not auto-rewrite. |

### Server side

| Mixpanel | PostHog |
|---|---|
| Node: `mp.people.set(distinct_id, { ... })` | `posthog.capture({ distinctId: distinct_id, event: '$set', properties: { $set: { ... } } })` |
| Python: `mp.people_set(distinct_id, props)` | `posthog.capture(distinct_id, '$set', { '$set': props })` |
| Ruby: `tracker.people.set(distinct_id, props)` | `posthog.capture(distinct_id: distinct_id, event: '$set', properties: { '$set' => props })` |
| `people_set_once` / `people.set_once` (any server SDK) | Same as above but event `$set_once` and payload key `$set_once`. |
| `people_unset` / `people.unset` (any server SDK) | Event `$unset`, payload `{ '$unset': [...] }`. |
| `people_increment`, `people_append`, `people_union`, `people_track_charge`, `people_delete_user` | _(ambiguous)_ — same reasons as the client-side row above. |

## Group analytics

| Mixpanel | PostHog |
|---|---|
| `mixpanel.set_group('company', 'co_123')` | `posthog.group('company', 'co_123')` |
| `mixpanel.set_group('company', 'co_123', { name: '...', ... })` | `posthog.group('company', 'co_123', { name: '...', ... })` |
| `mixpanel.get_group('company', 'co_123').set({ k: v })` | `posthog.group('company', 'co_123', { k: v })` |
| `mixpanel.get_group('company', 'co_123').set_once({ k: v })` | _(ambiguous)_ — PostHog `group()` does not distinguish set vs set_once. Mark `warning`. |
| `mixpanel.add_group('company', 'co_123')` | _(ambiguous)_ — PostHog has no append-to-group operation. Mark `warning`. |
| `mixpanel.remove_group('company', 'co_123')` | _(ambiguous)_ — same. |

Server side:

| Mixpanel | PostHog |
|---|---|
| Node: `mp.group_set('company', 'co_123', { ... })` | `posthog.groupIdentify({ groupType: 'company', groupKey: 'co_123', properties: { ... } })` |
| Python: `mp.group_set('company', 'co_123', { ... })` | `posthog.group_identify('company', 'co_123', { ... })` |
| Ruby: `tracker.groups.set('company', 'co_123', { ... })` | `posthog.group_identify(group_type: 'company', group_key: 'co_123', properties: { ... })` |

## Opt-out / privacy

| Mixpanel | PostHog |
|---|---|
| `mixpanel.opt_out_tracking()` | `posthog.opt_out_capturing()` |
| `mixpanel.opt_in_tracking()` | `posthog.opt_in_capturing()` |
| `mixpanel.has_opted_out_tracking()` | `posthog.has_opted_out_capturing()` |
| `mixpanel.has_opted_in_tracking()` | _(ambiguous)_ — PostHog only exposes `has_opted_out_capturing`. Use `!posthog.has_opted_out_capturing()` when the call site reads the boolean directly; mark `warning` if the call is wired into a more complex consent flow that needs operator review. |
| `mixpanel.clear_opt_in_out_tracking()` | _(ambiguous)_ — PostHog has no single "reset opt state" call. Mark `warning`. |

## Shutdown / flush (server SDKs)

| Mixpanel | PostHog |
|---|---|
| Node: `mp.flush(cb?)` | `await posthog.shutdown()` — PostHog's Node SDK exposes `shutdown()` which flushes; there is no separate `flush()` on the public surface for most call sites. If the original Mixpanel call is mid-request (not at process exit), use `await posthog.flush()`. |
| Python: `consumer.flush()` (buffered) | `posthog.flush()` |
| Ruby: `tracker.flush` (buffered) | `posthog.flush` |
| Go: `client.Flush(ctx)` | `posthogClient.Close()` (PostHog Go SDK flushes on close). |
| PHP: queue flush on destruct | _(ambiguous)_ — PHP PostHog flushes on `__destruct` by default; no explicit call to translate. |

Client-side `mixpanel.flush` (rare) → _(ambiguous)_ — no PostHog browser equivalent. Mark `warning`.

## Import line cleanup

After all call sites in a file are rewritten, the file's Mixpanel imports become unused. The agent removes them in the same `Edit` that rewrote the last call site, e.g.:

- `import mixpanel from 'mixpanel-browser';` → remove the line.
- `import { Mixpanel } from 'mixpanel-react-native';` → remove the line.
- `const Mixpanel = require('mixpanel');` → remove the line.
- `from mixpanel import Mixpanel` → remove the line.
- `require 'mixpanel-ruby'` → remove the line.
- `import Mixpanel` (Swift) → remove the line.
- `import com.mixpanel.android.mpmetrics.MixpanelAPI;` → remove the line.

Also remove the inline CDN bootstrap snippet from HTML templates once the page's Mixpanel calls are gone.

Do not touch unrelated imports in the file.
