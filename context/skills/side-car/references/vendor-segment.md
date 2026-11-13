---
title: Segment side-car
description: Segment analytics-next packages, automatic events, plugin and identity rules
---

# Segment side-car

## Packages and init

- `@segment/analytics-next`: `AnalyticsBrowser.load({ writeKey })`, or `new AnalyticsBrowser()` and a later `.load(…)`.
- Snippet install (Analytics.js 2.0): `window.analytics`, loaded from `cdn.segment.com/analytics.js`. Its `register()` and `reset()` are buffered the same way, so call `installPosthogSidecar(window.analytics)` right after `analytics.load(…)`.

## Automatic events

Segment's only automatic call is `page()` (and `screen()` on mobile). The plugin does not forward them. Make sure posthog-js captures page views: `capture_pageview` (`defaults: '2025-05-24'` or `'history_change'` for single-page apps). Leave `autocapture` at its default (`true`), and set `capture_pageleave: true`.

## What the plugin forwards

| Segment call | PostHog call |
|---|---|
| `track(event, properties)` | `capture(event, properties)` |
| `userId` on any track event | `identify(userId)` |
| `identify(userId, traits)` | `identify(userId, traits)` |
| `identify(traits)` (no user id) | `setPersonProperties(traits)` |
| `group(groupId, traits)` | `group('company', groupId, traits)` |
| `alias(userId)` | `alias(userId)` |
| `reset()` | `reset()` (method wrap: `reset()` does not pass through plugins) |

Segment `group()` has no group type. The plugin uses `company`. If the app's groups are something else (teams, workspaces, organizations), change `GROUP_TYPE` and note it in the report.

Spec events such as `Order Completed` and `Product Added` keep their names and properties.

## No PostHog equivalent

None for browser calls. `analytics.screen()` stays Segment-only.

## Plugin

```ts
import type { AnalyticsBrowser, Context, Plugin } from '@segment/analytics-next';
import {
  forwardAlias,
  forwardEvent,
  forwardGroup,
  forwardIdentify,
  forwardPersonProps,
  forwardReset,
} from './posthog-sidecar';

/** Segment's `group()` has no type; PostHog needs one. Change it if the app's groups are not companies. */
const GROUP_TYPE = 'company';

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    // Never break Segment's pipeline.
  }
}

export const posthogSidecarPlugin: Plugin = {
  name: 'PostHog Side-car',
  type: 'enrichment',
  version: '1.0.0',
  isLoaded: () => true,
  load: () => Promise.resolve(),
  track: (ctx: Context) => {
    safe(() => {
      const { event, properties, userId } = ctx.event;
      if (userId) forwardIdentify('segment', userId);
      forwardEvent('segment', event, properties);
    });
    return ctx;
  },
  identify: (ctx: Context) => {
    safe(() => {
      const { userId, traits } = ctx.event;
      if (userId) forwardIdentify('segment', userId, traits);
      else forwardPersonProps('segment', { set: traits });
    });
    return ctx;
  },
  group: (ctx: Context) => {
    safe(() => forwardGroup('segment', GROUP_TYPE, ctx.event.groupId, ctx.event.traits));
    return ctx;
  },
  alias: (ctx: Context) => {
    safe(() => forwardAlias('segment', ctx.event.userId));
    return ctx;
  },
  // page() and screen() are not forwarded: posthog-js captures $pageview itself.
};

const MARK = '__posthogSidecar';

/** Call right after AnalyticsBrowser.load() (or on window.analytics for a snippet install). */
export function installPosthogSidecar(analytics: Pick<AnalyticsBrowser, 'register' | 'reset'>): void {
  const target = analytics as unknown as Record<string, unknown> & { [MARK]?: boolean };
  if (target[MARK]) return;
  target[MARK] = true;
  void analytics.register(posthogSidecarPlugin);
  // reset() does not pass through plugins.
  const originalReset = analytics.reset;
  target.reset = function (this: unknown, ...args: unknown[]) {
    safe(() => forwardReset());
    return (originalReset as (...a: unknown[]) => unknown).apply(this ?? analytics, args);
  };
}
```

## Register

Call `installPosthogSidecar(analytics)` right after the `AnalyticsBrowser` is created or loaded. Plugins registered before `load()` resolve are buffered, so the order is safe.
