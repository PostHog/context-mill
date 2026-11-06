---
title: Side-car core module
description: The shared module every vendor plugin forwards through
---

# Side-car core module

Every vendor plugin calls these functions. The core holds the rules that apply to every vendor:

- **Safe:** every call is wrapped in `try`/`catch` and does nothing during server rendering.
- **Ordered:** calls made before posthog-js finishes loading are queued (up to 200) and flushed when it loads. Vendors often initialize before PostHog does.
- **Clean:** vendor bookkeeping keys (`token`, `distinct_id`, `$insert_id`, `mp_lib`, `[Amplitude] …`, Segment `context`, and others) are dropped, and `Date` values become ISO strings.
- **Tagged:** every forwarded event carries `$sidecar_source: '<vendor>'`.
- **Direct:** event names pass through unchanged. Names that start with `$` are skipped, because PostHog reserves them.
- **Identity:** `identify` runs only when the id differs from the current PostHog distinct id. Otherwise, the properties go through `setPersonProperties`. Mixpanel's anonymous `$device:` ids are never identified.

Write this file as the core module. Do not change its behavior.

```ts
import posthog from 'posthog-js';

export type SidecarVendor = 'amplitude' | 'mixpanel' | 'segment' | 'heap';
type Props = Record<string, unknown>;

/** Vendor bookkeeping keys that PostHog sets for itself or that mean nothing outside the vendor. */
const DROPPED_KEYS = new Set([
  'token', 'distinct_id', '$distinct_id', '$device_id', '$user_id', '$insert_id', 'insert_id',
  'time', 'mp_lib', 'mp_loader', '$lib_version', '$mp_api_endpoint', '$mp_api_timestamp_ms',
  'messageId', 'context', 'integrations', '_metadata',
]);
const DROPPED_PREFIXES = ['[Amplitude] ', '$mp_'];

const MAX_PENDING = 200;
const pending: (() => void)[] = [];
let flushTimer: ReturnType<typeof setInterval> | undefined;

function isLoaded(): boolean {
  return typeof window !== 'undefined' && Boolean((posthog as unknown as { __loaded?: boolean }).__loaded);
}

/** Runs now when posthog-js is ready; otherwise queues until it loads (vendors often init first). */
function run(fn: () => void): void {
  if (typeof window === 'undefined') return;
  if (isLoaded()) {
    try {
      fn();
    } catch {
      // The side-car must never break the vendor pipeline.
    }
    return;
  }
  if (pending.length < MAX_PENDING) pending.push(fn);
  if (flushTimer) return;
  let ticks = 0;
  flushTimer = setInterval(() => {
    ticks += 1;
    if (!isLoaded() && ticks < 120) return;
    clearInterval(flushTimer);
    flushTimer = undefined;
    const queued = pending.splice(0);
    if (!isLoaded()) return;
    for (const queuedFn of queued) {
      try {
        queuedFn();
      } catch {
        // Ignore: one bad call must not stop the rest.
      }
    }
  }, 250);
}

function normalize(value: unknown, depth = 0): unknown {
  if (value instanceof Date) return value.toISOString();
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => normalize(item, depth + 1));
  const out: Props = {};
  for (const [key, inner] of Object.entries(value as Props)) {
    if (inner !== undefined && typeof inner !== 'function') out[key] = normalize(inner, depth + 1);
  }
  return out;
}

/** Drops vendor bookkeeping keys and converts Dates to ISO strings. */
export function cleanProps(props: unknown): Props {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return {};
  const out: Props = {};
  for (const [key, value] of Object.entries(props as Props)) {
    if (value === undefined || typeof value === 'function') continue;
    if (DROPPED_KEYS.has(key) || DROPPED_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    out[key] = normalize(value);
  }
  return out;
}

function hasKeys(props: Props | undefined): props is Props {
  return Boolean(props) && Object.keys(props as Props).length > 0;
}

export function forwardEvent(vendor: SidecarVendor, name: unknown, props?: unknown): void {
  if (typeof name !== 'string' || name.trim() === '' || name.startsWith('$')) return;
  const properties = { ...cleanProps(props), $sidecar_source: vendor };
  run(() => posthog.capture(name, properties));
}

export function forwardIdentify(
  vendor: SidecarVendor,
  distinctId: unknown,
  set?: unknown,
  setOnce?: unknown,
): void {
  if (distinctId === null || distinctId === undefined) return;
  const id = String(distinctId).trim();
  if (id === '' || id.startsWith('$device:')) return;
  const $set = cleanProps(set);
  const $setOnce = cleanProps(setOnce);
  run(() => {
    if (posthog.get_distinct_id() === id) {
      if (hasKeys($set) || hasKeys($setOnce)) posthog.setPersonProperties($set, $setOnce);
      return;
    }
    posthog.identify(id, hasKeys($set) ? $set : undefined, hasKeys($setOnce) ? $setOnce : undefined);
  });
}

export function forwardPersonProps(
  vendor: SidecarVendor,
  ops: { set?: unknown; setOnce?: unknown; unset?: string[] },
): void {
  const $set = cleanProps(ops.set);
  const $setOnce = cleanProps(ops.setOnce);
  const $unset = (ops.unset ?? []).filter((key) => typeof key === 'string' && key !== '');
  run(() => {
    if (hasKeys($set) || hasKeys($setOnce)) posthog.setPersonProperties($set, $setOnce);
    if ($unset.length > 0) posthog.capture('$set', { $unset, $sidecar_source: vendor });
  });
}

export function forwardGroup(vendor: SidecarVendor, groupType: unknown, groupKey: unknown, props?: unknown): void {
  if (typeof groupType !== 'string' || groupType === '') return;
  if (groupKey === null || groupKey === undefined || String(groupKey) === '') return;
  const groupProps = cleanProps(props);
  run(() => posthog.group(groupType, String(groupKey), hasKeys(groupProps) ? groupProps : undefined));
}

export function forwardRegister(vendor: SidecarVendor, props: unknown, once = false): void {
  const superProps = cleanProps(props);
  if (!hasKeys(superProps)) return;
  run(() => (once ? posthog.register_once(superProps) : posthog.register(superProps)));
}

export function forwardUnregister(vendor: SidecarVendor, key: unknown): void {
  if (typeof key !== 'string' || key === '') return;
  run(() => posthog.unregister(key));
}

export function forwardAlias(vendor: SidecarVendor, alias: unknown): void {
  if (alias === null || alias === undefined || String(alias) === '') return;
  run(() => posthog.alias(String(alias)));
}

export function forwardReset(): void {
  run(() => posthog.reset());
}
```
