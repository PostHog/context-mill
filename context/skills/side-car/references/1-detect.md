---
title: Find analytics vendors and pick one
next_step: 2-install-posthog.md
---

# Step 1, find the vendor SDKs and pick one to bridge

Discovery only. Do not modify project source. Do not write the plan file yet, Step 3 owns it.

## Status

```
[STATUS] Scanning project for analytics SDKs
[STATUS] Choosing vendor to bridge
```

## What counts as a vendor integration

A vendor counts when it is initialized in **browser** code and the app calls it at least once. Look for these signals.

| Vendor | Packages | Snippet or global | Init call |
|---|---|---|---|
| Amplitude | `@amplitude/analytics-browser`, `@amplitude/unified`, `amplitude-js` (legacy) | `window.amplitude`, `cdn.amplitude.com` | `amplitude.init(` or `initAll(` |
| Mixpanel | `mixpanel-browser` | `window.mixpanel`, `cdn.mxpnl.com` | `mixpanel.init(` |
| Segment | `@segment/analytics-next` | `window.analytics`, `cdn.segment.com/analytics.js` | `AnalyticsBrowser.load(`, `analytics.load(` |
| Heap | none (snippet only); `@heap/react-native-heap` is mobile and not supported | `window.heap`, `heap-api.com`, `heapanalytics.com` | `heap.load(` |

Read the dependency manifest, then search the source tree (skip `node_modules`, build output and lock files) for the snippet, global and init patterns. For each vendor, note the init file and line, and count its call sites.

Server-only SDKs (`@amplitude/analytics-node`, `mixpanel` for Node, `@segment/analytics-node`) do not count. The side-car runs in the browser. Mention them in the report's follow-ups.

`amplitude-js` (the legacy Amplitude SDK) has no plugin API. If it is the only vendor, treat it as found but record `warning`. `references/vendor-amplitude.md` says what to tell the operator.

## Pick one vendor

- **None found:** emit `[ABORT] No supported analytics SDK found` and stop.
- **Exactly one found:** use it.
- **Several found:** call `mcp__wizard-tools__wizard_ask` once. Ask which single vendor to bridge. Offer each found vendor as an option, with its init file and call-site count in the option description. Explain that only one is bridged so each action reaches PostHog once.
- **Several found and `wizard_ask` is not available** (a CI run): emit `[ABORT] Several analytics SDKs found` and stop.

## Carry the outcome forward

Remember the chosen vendor id (`amplitude`, `mixpanel`, `segment` or `heap`), its init file and line, the other vendors found, and the call-site counts. Step 3 writes them to the plan file.

Continue to `2-install-posthog.md`.
