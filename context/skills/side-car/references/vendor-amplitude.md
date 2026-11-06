---
title: Amplitude side-car
description: Amplitude Browser SDK 2 packages, automatic events, plugin and identity rules
---

# Amplitude side-car

## Packages and init

- `@amplitude/analytics-browser` (Browser SDK 2): `amplitude.init(API_KEY, options)` or `createInstance()`. Supported.
- `@amplitude/unified`: `initAll(API_KEY, { analytics: options })`. The analytics client is the same Browser SDK 2, so the same plugin works; register it on the analytics client.
- Snippet install: `window.amplitude`, loaded from `cdn.amplitude.com`. The snippet proxies `add()`, so call `installPosthogSidecar(window.amplitude)`.
- `amplitude-js` (legacy SDK 8): has no plugin API. Do not wrap it. Record `warning` in the plan, and tell the operator to upgrade to Browser SDK 2 before adding the side-car.

## Automatic events

Amplitude's automatic events start with `[Amplitude]` (Page Viewed, Form Started, Form Submitted, File Downloaded, Element Clicked, and others) or are `session_start`/`session_end`. The plugin skips them. Turn on the PostHog equivalents in the posthog-js init:

| Amplitude `defaultTracking` / `autocapture` option | posthog-js option |
|---|---|
| `pageViews` (on by default) | `capture_pageview` (`defaults: '2025-05-24'` or `'history_change'` for single-page apps) |
| `sessions` | none needed: PostHog sessions are automatic |
| `formInteractions`, `fileDownloads`, `elementInteractions` | `autocapture: true` (the default) |
| `frustrationInteractions` | `rageclick: true` (the default) and `capture_dead_clicks: true` |
| `attribution` | none needed: posthog-js records UTM and referrer properties itself |
| `webVitals` | `capture_performance: { web_vitals: true }` |

## What the plugin forwards

| Amplitude call | PostHog call |
|---|---|
| `track(name, props)` | `capture(name, props)` |
| `setUserId(id)`, or `user_id` on any event | `identify(id)` |
| `identify(new Identify().set(…).setOnce(…))` | `setPersonProperties($set, $set_once)`, or `identify(id, $set, $set_once)` when a user id is present |
| `Identify().unset(key)` | a `$set` event with `$unset: [key]` |
| `setGroup(type, name)` | `group(type, name)` (the first name if an array) |
| `groupIdentify(type, name, identify)` | `group(type, name, props)` |
| `revenue(new Revenue()…)` | `capture('revenue', { revenue, price, quantity, product_id, revenue_type, currency, …props })`. `revenue` is `$revenue` when set, otherwise price × quantity. |
| `reset()` | `reset()` through the plugin's `onReset` hook |

## No PostHog equivalent

These `Identify` operations stay Amplitude-only. List each call site in the plan's unsupported table: `.add()`, `.append()`, `.prepend()`, `.preInsert()`, `.postInsert()`, `.remove()`, `.clearAll()`.

## Plugin

```ts
import * as amplitude from '@amplitude/analytics-browser';
import type { Types } from '@amplitude/analytics-browser';
import {
  forwardEvent,
  forwardGroup,
  forwardIdentify,
  forwardPersonProps,
  forwardReset,
} from './posthog-sidecar';

type Ops = Record<string, Record<string, unknown> | undefined>;

/** Amplitude's own automatic events. PostHog captures its equivalents itself. */
const SKIPPED_EVENTS = new Set(['session_start', 'session_end']);

function firstGroupName(name: unknown): unknown {
  return Array.isArray(name) ? name[0] : name;
}

function revenueProps(props: Record<string, unknown>): Record<string, unknown> {
  const { $price, $quantity, $productId, $revenueType, $currency, $revenue, ...rest } = props;
  const price = typeof $price === 'number' ? $price : undefined;
  const quantity = typeof $quantity === 'number' ? $quantity : 1;
  return {
    ...rest,
    revenue: typeof $revenue === 'number' ? $revenue : price !== undefined ? price * quantity : undefined,
    price,
    quantity,
    product_id: $productId,
    revenue_type: $revenueType,
    currency: $currency,
  };
}

function handle(event: Types.Event): void {
  const type = event.event_type;
  const userId = event.user_id;

  if (type === '$identify') {
    const ops = (event.user_properties ?? {}) as Ops;
    if (userId) forwardIdentify('amplitude', userId, ops.$set, ops.$setOnce);
    else forwardPersonProps('amplitude', { set: ops.$set, setOnce: ops.$setOnce });
    if (ops.$unset) forwardPersonProps('amplitude', { unset: Object.keys(ops.$unset) });
    // setGroup() arrives as an $identify that carries `groups`.
    for (const [groupType, groupName] of Object.entries(event.groups ?? {})) {
      forwardGroup('amplitude', groupType, firstGroupName(groupName));
    }
    return;
  }

  if (type === '$groupidentify') {
    const ops = (event.group_properties ?? {}) as Ops;
    for (const [groupType, groupName] of Object.entries(event.groups ?? {})) {
      forwardGroup('amplitude', groupType, firstGroupName(groupName), { ...ops.$setOnce, ...ops.$set });
    }
    return;
  }

  if (type.startsWith('[Amplitude]') || SKIPPED_EVENTS.has(type)) return;

  if (userId) forwardIdentify('amplitude', userId);
  if (type === 'revenue_amount') {
    forwardEvent('amplitude', 'revenue', revenueProps({ ...event.event_properties }));
    return;
  }
  forwardEvent('amplitude', type, event.event_properties);
}

export function posthogSidecarPlugin(): Types.EnrichmentPlugin {
  return {
    name: 'posthog-sidecar',
    type: 'enrichment',
    async execute(event) {
      try {
        handle(event);
      } catch {
        // Never break Amplitude's pipeline.
      }
      return event;
    },
    async onIdentityChanged(identity) {
      try {
        if (identity.userId) forwardIdentify('amplitude', identity.userId);
      } catch {
        // Ignore.
      }
    },
    async onReset() {
      try {
        forwardReset();
      } catch {
        // Ignore.
      }
    },
  };
}

let installed = false;

/** Call once, right after amplitude.init(). Pass an instance from createInstance() if the app uses one. */
export function installPosthogSidecar(client: Pick<typeof amplitude, 'add'> = amplitude): void {
  if (installed) return;
  installed = true;
  client.add(posthogSidecarPlugin());
}
```

## Register

Call `installPosthogSidecar()` right after `amplitude.init(…)`. For `createInstance()`, pass that instance: `installPosthogSidecar(instance)`. Registering before `init` also works, because Amplitude queues `add()`.
