---
title: Mixpanel side-car
description: mixpanel-browser packages, automatic events, hooks and identity rules
---

# Mixpanel side-car

## Packages and init

- `mixpanel-browser`: `mixpanel.init(TOKEN, options)`, sometimes with a name for a second instance: `mixpanel.init(TOKEN, options, 'name')` (that instance is `mixpanel.name`).
- Snippet install: `window.mixpanel`, loaded from `cdn.mxpnl.com`. Call `installPosthogSidecar(window.mixpanel)` inside the `loaded` callback of `mixpanel.init`.

The plugin uses Mixpanel's `hooks` config. Check that the installed library supports it: search `node_modules/mixpanel-browser/dist/mixpanel.cjs.js` for `before_track` and `before_send_`. If either is missing, record `warning` and tell the operator to upgrade `mixpanel-browser`. Do not write a fallback.

## Automatic events

Mixpanel's automatic events start with `$mp_` (`$mp_web_page_view`, `$mp_click`, `$mp_submit`, `$mp_scroll`, `$mp_page_leave`, and others). Its internal identity events are `$identify`, `$create_alias` and `$merge`. The plugin skips all of them. Turn on the PostHog equivalents in the posthog-js init:

| Mixpanel option | posthog-js option |
|---|---|
| `track_pageview` (`true`, `'url-with-path'`, …) | `capture_pageview` (`defaults: '2025-05-24'` or `'history_change'` for single-page apps) |
| `autocapture` (click, input, submit, scroll) | `autocapture: true` (the default) |
| `autocapture.pageleave` | `capture_pageleave: true` |
| `record_sessions_percent` | session replay is on by default in posthog-js: leave it on |

## What the plugin forwards

| Mixpanel call | Mechanism | PostHog call |
|---|---|---|
| `track(name, props)` | `before_track` hook | `capture(name, props)`. Super properties are not merged in: they reach PostHog through `register`. |
| `identify(id)` | `before_identify` hook | `identify(id)` |
| already-identified visitor at install | read once | `identify(get_distinct_id())` |
| `register(props)` / `register_once(props)` | hooks | `register(props)` / `register_once(props)` |
| super properties persisted before install | read once | `register(props)` |
| `unregister(key)` | hook | `unregister(key)` |
| `people.set` / `set_once` / `unset` | `before_send_people` hook | `setPersonProperties` / `$unset` |
| `get_group(key, id).set(props)` | `before_send_groups` hook | `group(key, id, props)` |
| `set_group(key, ids)` / `add_group(key, id)` | method wrap | `group(key, id)` (the first id if an array) |
| `alias(alias)` | method wrap | `alias(alias)` |
| `reset()` | method wrap | `reset()` |

## Hook rules

- A Mixpanel hook must return its arguments. A hook that returns `undefined` makes Mixpanel drop the call. Every hook in the plugin returns its arguments, even after an error.
- `set_config({ hooks })` replaces all hooks. The plugin reads the existing hooks and appends its own, so hooks the app configured keep running first.

## No PostHog equivalent

These stay Mixpanel-only. List each call site in the plan's unsupported table: `people.increment`, `people.append`, `people.union`, `people.remove`, `people.track_charge`, `people.delete_user`, `time_event` (the `$duration` property is still forwarded with the event).

## Plugin

```ts
import mixpanel, { type Mixpanel } from 'mixpanel-browser';
import {
  forwardAlias,
  forwardEvent,
  forwardGroup,
  forwardIdentify,
  forwardPersonProps,
  forwardRegister,
  forwardReset,
  forwardUnregister,
} from './posthog-sidecar';

type Hook = (...args: unknown[]) => unknown;
type Props = Record<string, unknown>;

/** Mixpanel's automatic and internal events. PostHog captures its equivalents itself. */
const SKIPPED_EVENT = /^\$(mp_|identify$|create_alias$|merge$)/;
const MARK = '__posthogSidecar';

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    // Never break Mixpanel.
  }
}

function asArray(value: unknown): Hook[] {
  if (typeof value === 'function') return [value as Hook];
  return Array.isArray(value) ? (value.filter((item) => typeof item === 'function') as Hook[]) : [];
}

/** Hooks must return their arguments: a hook that returns undefined makes Mixpanel drop the call. */
const sidecarHooks: Record<string, Hook> = {
  before_track: (name, props) => {
    safe(() => {
      if (typeof name === 'string' && !SKIPPED_EVENT.test(name)) forwardEvent('mixpanel', name, props);
    });
    return [name, props];
  },
  before_identify: (distinctId) => {
    safe(() => forwardIdentify('mixpanel', distinctId));
    return [distinctId];
  },
  before_register: (props, options) => {
    safe(() => forwardRegister('mixpanel', props));
    return [props, options];
  },
  before_register_once: (props, defaultValue, options) => {
    safe(() => forwardRegister('mixpanel', props, true));
    return [props, defaultValue, options];
  },
  before_unregister: (property, options) => {
    safe(() => forwardUnregister('mixpanel', property));
    return [property, options];
  },
  before_send_people: (data) => {
    safe(() => {
      const update = (data ?? {}) as Props;
      forwardPersonProps('mixpanel', {
        set: update.$set,
        setOnce: update.$set_once,
        unset: Array.isArray(update.$unset) ? (update.$unset as string[]) : undefined,
      });
    });
    return [data];
  },
  before_send_groups: (data) => {
    safe(() => {
      const update = (data ?? {}) as Props;
      forwardGroup('mixpanel', update.$group_key, update.$group_id, update.$set);
    });
    return [data];
  },
};

function wrapMethod<K extends 'reset' | 'alias' | 'set_group' | 'add_group'>(
  client: Mixpanel,
  method: K,
  before: (...args: Parameters<Mixpanel[K]>) => void,
): void {
  const original = client[method] as ((...args: unknown[]) => unknown) & { [MARK]?: boolean };
  if (typeof original !== 'function' || original[MARK]) return;
  const wrapped = function (this: unknown, ...args: unknown[]) {
    safe(() => before(...(args as Parameters<Mixpanel[K]>)));
    return original.apply(this ?? client, args);
  } as typeof original;
  wrapped[MARK] = true;
  (client as unknown as Record<string, unknown>)[method] = wrapped;
}

/** Call right after mixpanel.init(). Merges with any hooks the app already configured. */
export function installPosthogSidecar(client: Mixpanel = mixpanel): void {
  const existing = (client.get_config('hooks') ?? {}) as Record<string, unknown>;
  if (Object.values(existing).some((value) => asArray(value).some((hook) => (hook as { [MARK]?: boolean })[MARK]))) {
    return;
  }
  const merged: Record<string, unknown> = { ...existing };
  for (const [name, hook] of Object.entries(sidecarHooks)) {
    (hook as Hook & { [MARK]?: boolean })[MARK] = true;
    merged[name] = [...asArray(existing[name]), hook];
  }
  client.set_config({ hooks: merged } as Parameters<Mixpanel['set_config']>[0]);

  // Super properties registered before install (init code, or a previous visit) are already persisted.
  safe(() => {
    const persisted = (client as unknown as { persistence?: { properties?: () => Props } }).persistence?.properties?.();
    if (persisted) forwardRegister('mixpanel', persisted);
  });
  // An already identified visitor: Mixpanel only calls before_identify when the id changes.
  safe(() => {
    const distinctId = client.get_distinct_id();
    const deviceId = client.get_property('$device_id');
    if (distinctId && distinctId !== deviceId) forwardIdentify('mixpanel', distinctId);
  });

  // These have no hooks.
  wrapMethod(client, 'reset', () => forwardReset());
  wrapMethod(client, 'alias', (alias) => forwardAlias('mixpanel', alias));
  wrapMethod(client, 'set_group', (groupKey, groupIds) =>
    forwardGroup('mixpanel', groupKey, Array.isArray(groupIds) ? groupIds[0] : groupIds),
  );
  wrapMethod(client, 'add_group', (groupKey, groupId) => forwardGroup('mixpanel', groupKey, groupId));
}
```

## Register

Call `installPosthogSidecar()` right after `mixpanel.init(…)`. For a named instance, pass it: `installPosthogSidecar(mixpanel.name)`. Do not call it before `init`: `set_config` needs an initialized instance.
