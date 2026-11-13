---
title: Heap side-car
description: Heap snippet install, automatic events, method wrapping and identity rules
---

# Heap side-car

## Packages and init

- Heap web is a snippet install: `window.heap`, loaded from `cdn.us.heap-api.com` or `cdn.heapanalytics.com`, started with `heap.load(ENV_ID)`. Some apps wrap the snippet in a module or a `<Script>` tag.
- `@heap/react-native-heap` is not supported: the side-car is browser-only. Record it as a follow-up.

Heap has no plugin API. The side-car wraps Heap's public methods.

## Automatic events

Heap captures page views, clicks, form submits and field changes automatically. Those never pass through `heap.track()`, so the wrapper cannot see them, which is the intended behavior. Turn on the PostHog equivalents in the posthog-js init: `capture_pageview` (`defaults: '2025-05-24'` or `'history_change'` for single-page apps), `autocapture: true` (the default), and `capture_pageleave: true`.

## What the wrapper forwards

| Heap call | PostHog call |
|---|---|
| `heap.track(name, props)` | `capture(name, props)` |
| `heap.identify(identity)` | `identify(identity)` |
| `heap.resetIdentity()` | `reset()` |
| `heap.addUserProperties(props)` | `setPersonProperties(props)` |
| `heap.addEventProperties(props)` | `register(props)` |
| `heap.removeEventProperty(key)` | `unregister(key)` |
| `heap.clearEventProperties()` | `unregister(key)` for every key the side-car registered |

## Snippet timing

The snippet first installs stub methods that queue calls. The real library replaces the stubs when it loads, and replays the queue.

- The side-car wraps the stubs at install, so calls made before Heap loads are forwarded once.
- It then polls every 500 ms for 30 s and wraps the real methods once they appear. The wrap is idempotent: a marker on each wrapped function prevents a second wrap.
- Install it right after `heap.load(…)` and before any other Heap call in the init code, so that init-time calls such as `addEventProperties` are forwarded.

## No PostHog equivalent

These stay Heap-only. List each call site in the plan's unsupported table: `heap.addAccountProperties`, `heap.addPageviewProperties`, `heap.trackPageview`.

## Plugin

```ts
import {
  forwardEvent,
  forwardIdentify,
  forwardPersonProps,
  forwardRegister,
  forwardReset,
  forwardUnregister,
} from './posthog-sidecar';

type HeapLike = Record<string, unknown>;
type Handler = (...args: unknown[]) => void;

const MARK = '__posthogSidecar';
/** Keys this side-car registered from addEventProperties, so clearEventProperties can remove them. */
const registeredKeys = new Set<string>();

const handlers: Record<string, Handler> = {
  track: (name, props) => forwardEvent('heap', name, props),
  identify: (identity) => forwardIdentify('heap', identity),
  resetIdentity: () => forwardReset(),
  addUserProperties: (props) => forwardPersonProps('heap', { set: props }),
  addEventProperties: (props) => {
    if (props && typeof props === 'object') Object.keys(props).forEach((key) => registeredKeys.add(key));
    forwardRegister('heap', props);
  },
  removeEventProperty: (key) => {
    if (typeof key === 'string') registeredKeys.delete(key);
    forwardUnregister('heap', key);
  },
  clearEventProperties: () => {
    registeredKeys.forEach((key) => forwardUnregister('heap', key));
    registeredKeys.clear();
  },
};

function wrap(heap: HeapLike | undefined): void {
  if (!heap) return;
  for (const [method, handler] of Object.entries(handlers)) {
    const original = heap[method] as ((...args: unknown[]) => unknown) & { [MARK]?: boolean };
    if (typeof original !== 'function' || original[MARK]) continue;
    const wrapped = function (this: unknown, ...args: unknown[]) {
      try {
        handler(...args);
      } catch {
        // Never break Heap.
      }
      return original.apply(this ?? heap, args);
    } as typeof original;
    wrapped[MARK] = true;
    heap[method] = wrapped;
  }
}

function heapGlobal(): HeapLike | undefined {
  return typeof window === 'undefined' ? undefined : ((window as unknown as { heap?: HeapLike }).heap);
}

/**
 * Call right after the Heap snippet's heap.load(). Heap has no plugin API, so this wraps its methods.
 * The snippet installs stub methods that queue calls; the real library later replaces them.
 * The stubs are wrapped now (so calls made before load are forwarded once), and the real
 * methods are wrapped by a poll after they appear. Heap replays queued calls into its real
 * methods synchronously on load, before the poll re-wraps, so queued calls are not forwarded twice.
 */
export function installPosthogSidecar(): void {
  const heap = heapGlobal();
  if (!heap) return;
  wrap(heap);
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
    wrap(heapGlobal());
    if (ticks >= 60) clearInterval(timer);
  }, 500);
}
```

## Register

Call `installPosthogSidecar()` right after `heap.load(…)` in the snippet or the module that loads it. In a framework where the snippet runs as an inline script, call it from the first client-side code that runs after the snippet, such as a root client component's effect.
