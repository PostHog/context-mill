# Mixpanel SDK reference

This file is the source of truth for what Mixpanel looks like in a codebase. It is factual, it does not describe PostHog. See `mapping.md` for the Mixpanel to PostHog mapping.

## Packages

Mixpanel ships under several package names depending on platform. When checking presence in Step 1 and when removing packages in Step 5, only act on packages that are actually in the project's manifest.

**JavaScript / TypeScript:**

- `mixpanel-browser` — browser client SDK (npm/yarn). Distinct from the server SDK below.
- `mixpanel` — Node.js server SDK (npm).
- `mixpanel-react-native` — React Native SDK.

The browser SDK is also commonly installed via a CDN snippet that bootstraps `window.mixpanel` from `cdn.mxpnl.com/libs/mixpanel-2-latest.min.js`. The snippet is a long IIFE that defines a stub on `window.mixpanel`; the page then calls `mixpanel.init('TOKEN', { ... })`. When there is no `mixpanel-browser` entry in the manifest but the project's HTML contains this snippet, Mixpanel is still in use.

**Other ecosystems:**

- Python: `mixpanel` (PyPI).
- Ruby: `mixpanel-ruby` (RubyGems).
- Java server: `com.mixpanel:mixpanel-java` (Maven).
- Android: `com.mixpanel.android:mixpanel-android` (Maven).
- Swift / iOS: `Mixpanel-swift` (CocoaPods, SwiftPM via `github.com/mixpanel/mixpanel-swift`). Legacy Obj-C SDK is `Mixpanel` (CocoaPods).
- Go: `github.com/mixpanel/mixpanel-go`.
- PHP: `mixpanel/mixpanel-php` (Composer).
- Flutter: `mixpanel_flutter` (pub.dev).
- Unity: `mixpanel-unity` (UPM / `.unitypackage`).

## Initialization shapes

Common initialization patterns the agent will see in source:

- `mixpanel.init('TOKEN', { autocapture, track_pageview, record_sessions_percent, ... })` — `mixpanel-browser`, plus CDN snippet.
- `const Mixpanel = require('mixpanel'); const mp = Mixpanel.init('TOKEN', { ... })` — Node server.
- `from mixpanel import Mixpanel; mp = Mixpanel('TOKEN')` — Python.
- `require 'mixpanel-ruby'; tracker = Mixpanel::Tracker.new('TOKEN')` — Ruby.
- `Mixpanel.initialize(token: 'TOKEN', trackAutomaticEvents: false)` — Swift / iOS.
- `MixpanelAPI.getInstance(context, 'TOKEN', trackAutomaticEvents: false)` — Android.
- `mixpanel.NewClientWithOptions('TOKEN', ...)` — Go.
- `Mixpanel::getInstance('TOKEN')` — PHP.
- `await Mixpanel.init('TOKEN', trackAutomaticEvents: false)` — Flutter.
- React Native: `const mixpanel = new Mixpanel('TOKEN', trackAutomaticEvents); await mixpanel.init()`.

### Common `init` options (browser SDK)

The browser SDK's options bag carries flags that toggle Mixpanel's optional client behaviors. None of these have a one-to-one PostHog `init` equivalent; the agent **drops** them on removal and lets the integration skill's PostHog defaults stand. Recognize them so you don't misread them as user-authored config:

- `autocapture: true | { ... }` — enables Mixpanel's autocapture (click, change, submit).
- `track_pageview: true | 'full-url' | 'url-with-path-and-query-string' | 'url-with-path'` — auto-emits page-view events.
- `record_sessions_percent: 0–100` — session replay sampling rate.
- `record_heatmap_data: true` — heatmap capture for replay.
- `persistence: 'cookie' | 'localStorage'` — where the distinct_id and super properties are stored.
- `debug: true` — verbose console logging.
- `ip: false` — disable IP-based geolocation.
- `opt_out_tracking_by_default: true` — opt users out until they opt in.
- `api_host: '...'` — for proxy or regional residency (EU / India).
- `loaded: function (mp) { ... }` — callback once the SDK is ready.

Mobile SDKs (iOS / Android / RN / Flutter) typically take a smaller bag: `trackAutomaticEvents`, server URL, opt-out default, flush interval.

### Reserved property prefix

Mixpanel reserves a set of well-known property keys with a `$` prefix — they map to Mixpanel-specific person fields and event fields. The common ones you'll see in source:

- `$email`, `$name`, `$first_name`, `$last_name`, `$phone`, `$avatar` — person profile properties.
- `$created` — account creation timestamp on a profile.
- `$city`, `$region`, `$country_code` — geolocation properties.
- `$duration` — auto-populated by `time_event`.
- `$insert_id` — server-side dedupe key.

PostHog person properties are unprefixed (`email`, `name`, etc.), so the mapping doc strips the leading `$` when translating identification calls and `people.set` payloads. Event-level reserved properties (`$insert_id`, `$duration`) do not have direct PostHog equivalents and are dropped on the way through unless the mapping explicitly says otherwise.

## Event tracking API

Browser / mobile (client SDKs):

- `mixpanel.track(eventName, properties?)` — log an event with a properties object.
- `mixpanel.track_pageview(properties?)` — explicit page view (often auto-enabled via `track_pageview: true` in `init`).
- `mixpanel.track_links(selector, eventName, properties?)` — capture clicks on matching DOM links.
- `mixpanel.track_forms(selector, eventName, properties?)` — capture form submissions.
- `mixpanel.time_event(eventName)` — start a timer; the next `track(eventName, …)` includes a `$duration`.
- `mixpanel.track_with_groups(eventName, properties, groupsObject)` — capture with explicit group context.

Server SDKs (caller supplies the distinct_id):

- Node: `mp.track(eventName, { distinct_id, ...properties })`.
- Python: `mp.track(distinct_id, eventName, properties)`.
- Ruby: `tracker.track(distinct_id, eventName, properties)`.
- Java: `messageBuilder.event(distinct_id, eventName, properties)` followed by `mixpanel.deliver(...)`.
- Go: `client.Track(ctx, []*Event{ ... })`.
- PHP: `$mp->track(eventName, [ 'distinct_id' => ..., ...properties ])`.

## Super properties (client SDKs only)

- `mixpanel.register({ key: value, ... })` — sets a property that is appended to every subsequent event from this device. Persisted in the Mixpanel cookie / local storage.
- `mixpanel.register_once({ key: value, ... })` — sets only if the key is not already registered.
- `mixpanel.unregister('key')` — removes a registered super property.

Server SDKs do not have a super-properties concept.

## User identity API

- `mixpanel.identify(distinctId)` — client SDK; sets the distinct_id on the current device.
- `mixpanel.identify(distinctId, { $email, name, ... })` — less common; some teams pass identity + traits in one call.
- `mixpanel.alias(newId, existingId?)` — legacy bridge call that merges the current anonymous id with `newId` server-side. Some older codebases use `alias` in addition to `identify`.
- `mixpanel.reset()` — clears the current identity and regenerates a new anonymous distinct_id. Typically called on logout.

Server SDKs do not have an `identify` call; the distinct_id is passed inline to every `track` and `people.*` call.

## People / profile properties API

Browser / mobile:

- `mixpanel.people.set({ key: value, ... })` — set or overwrite profile properties on the currently identified user.
- `mixpanel.people.set_once({ key: value, ... })` — set only if not already set.
- `mixpanel.people.unset(['key1', 'key2'])` — remove properties.
- `mixpanel.people.increment('property', by?)` — increment a numeric property. `by` defaults to 1.
- `mixpanel.people.append('property', value)` — append to a list property.
- `mixpanel.people.union('property', [values])` — union into a set property.
- `mixpanel.people.track_charge(amount, properties?)` — Mixpanel's revenue tracking; logs a transaction on the user profile.
- `mixpanel.people.clear_charges()` — wipe the revenue log.
- `mixpanel.people.delete_user()` — delete the current user's profile.

Server SDKs (each method takes `distinct_id` as first arg):

- Node: `mp.people.set(distinct_id, properties, modifiers?)`, `mp.people.set_once(...)`, `mp.people.unset(...)`, `mp.people.increment(...)`, `mp.people.append(...)`, `mp.people.union(...)`, `mp.people.track_charge(...)`, `mp.people.delete_user(...)`.
- Python: `mp.people_set(distinct_id, properties, meta?)`, `mp.people_set_once(...)`, `mp.people_unset(...)`, `mp.people_increment(...)`, `mp.people_append(...)`, `mp.people_union(...)`, `mp.people_track_charge(...)`, `mp.people_delete_user(...)`.
- Ruby: `tracker.people.set(distinct_id, properties, ip?)`, `tracker.people.set_once(...)`, `tracker.people.append(...)`, `tracker.people.union(...)`, `tracker.people.increment(...)`, `tracker.people.track_charge(...)`, `tracker.people.delete_user(...)`.

## Group analytics

- `mixpanel.set_group(groupType, groupKeyOrKeys)` — associate the current user with a group; subsequent events carry the group.
- `mixpanel.add_group(groupType, groupKey)` — append a group identifier to a multi-group property.
- `mixpanel.remove_group(groupType, groupKey)` — remove a group identifier.
- `mixpanel.get_group(groupType, groupKey).set({ ... })` — set or update group profile properties. Also: `.set_once`, `.unset`, `.remove`, `.union`, `.delete`.
- `mixpanel.track_with_groups(event, props, { groupType: groupKey })` — capture an event scoped to specific groups without modifying the user's group state.

Server SDKs expose group-profile helpers — the names vary by language:

- Node: `mp.group_set(groupType, groupKey, properties)`, plus `group_set_once`, `group_unset`, `group_union`, `group_remove`, `group_delete`.
- Python: `mp.group_set(group_key, group_id, properties)`, `mp.group_set_once(...)`, `mp.group_unset(...)`, `mp.group_union(...)`, `mp.group_remove(...)`, `mp.group_delete(...)`.
- Ruby: `tracker.groups.set(groupType, groupKey, properties)`, plus `tracker.groups.set_once`, `tracker.groups.unset`, `tracker.groups.union`, `tracker.groups.remove`, `tracker.groups.delete`.
- Java: `messageBuilder.groupSet(...)`, `groupSetOnce(...)`, `groupUnset(...)`, etc. — same family wrapped through the message builder.
- PHP / Go: equivalent helpers on the client object.

Server `track` calls associate an event with groups by including a `$groups` property in the event properties object (e.g., `mp.track('e', { distinct_id, $groups: { company: 'co_123' } })`).

## Opt-out / privacy

- `mixpanel.opt_out_tracking(options?)` — stop sending events from this device.
- `mixpanel.opt_in_tracking(options?)` — resume.
- `mixpanel.has_opted_out_tracking()` — boolean check.
- `mixpanel.has_opted_in_tracking()` — boolean check.
- `mixpanel.clear_opt_in_out_tracking()` — reset to the default state.

## Shutdown / flush

Server SDKs only — browser events fire synchronously enough that the page doesn't typically need an explicit flush.

- Node: `mp.flush(callback?)` — typically called before process exit.
- Python: no explicit flush method on the default `Mixpanel` class. The buffered consumer variant exposes `consumer.flush()`.
- Ruby: `tracker.flush` when using the buffered consumer.
- Go: `client.Flush(ctx)`.
- PHP: `Mixpanel::getInstance('TOKEN')->reset()` to clear the queue; the singleton flushes on destruct.

## Notes on detection

A Mixpanel package in the manifest is not enough on its own — a project can list it with zero call sites. The robust signal is a Mixpanel package **plus at least one** of:

- A `mixpanel.init`, `Mixpanel.init`, `Mixpanel::Tracker.new`, `Mixpanel.initialize`, or equivalent SDK constructor call.
- A `track`, `track_pageview`, `track_links`, `track_forms`, `track_with_groups`, or `time_event` call.
- An `identify`, `alias`, or `reset` call.
- A `register` / `register_once` call.
- Any `people.*` / `people_*` method call.
- A `set_group` / `add_group` / `get_group` call.
- The inline CDN snippet that assigns `window.mixpanel` (the `(function (f, b) { if (!b.__SV) { ... })(document, window.mixpanel || []);` IIFE).

## Leftover provider config

Mixpanel does not write a dotfile or JSON config at the project root. There are no leftover artifacts to remove in Step 5 beyond the package itself and any inline CDN script tags in HTML templates.

## Common environment variables

Mixpanel SDKs do not enforce an env-var convention — the project token is typically passed as a string literal to `init`. That said, the patterns you'll see in source:

- `MIXPANEL_TOKEN` / `NEXT_PUBLIC_MIXPANEL_TOKEN` / `VITE_MIXPANEL_TOKEN` / `REACT_APP_MIXPANEL_TOKEN` — project token.
- `MIXPANEL_PROJECT_ID`, `MIXPANEL_USERNAME`, `MIXPANEL_SECRET` — service-account credentials used by export / import scripts, **not** by the SDK. Leave these alone; they're for the data-migration tool, which is a separate workstream.
- `MIXPANEL_API_HOST` — used when a project proxies Mixpanel ingestion through a custom domain.

When Step 5 removes the SDK package, leave the env-var declarations in `.env*` files in place — they're operator-owned secrets, and removing them risks breaking unrelated tooling. The migration report's "Manual follow-ups" section flags them for the operator to clean up.
