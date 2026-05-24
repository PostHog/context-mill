# Statsig SDK reference

This file is the source of truth for what Statsig looks like in a codebase. It is factual, it does not describe PostHog. See `mapping.md` for the Statsig to PostHog mapping.

## Packages

Statsig ships under several package names depending on platform and SDK generation. When checking presence in Step 1 and when removing packages in Step 5, only act on packages that are actually in the project's manifest.

**JavaScript / TypeScript — first-generation SDKs:**

- `statsig-js` — browser client SDK.
- `statsig-react` — React bindings for `statsig-js`.
- `statsig-react-native` — React Native bindings.
- `statsig-node` — server SDK for Node.
- `statsig-node-lite` — slimmer Node server SDK.

**JavaScript / TypeScript — current "@statsig" SDKs:**

- `@statsig/js-client` — current browser client.
- `@statsig/react-bindings` — current React bindings.
- `@statsig/react-native-bindings` — current React Native bindings.
- `@statsig/expo-bindings` — Expo bindings.
- `@statsig/js-on-device-eval-client` — on-device-eval browser client.
- `@statsig/web-analytics` — web analytics add-on.
- `@statsig/session-replay` — session replay add-on.

**Other ecosystems:**

- Python: `statsig` (PyPI).
- Ruby: `statsig-ruby` (RubyGems).
- PHP / Laravel: `statsig/statsigsdk` (Composer).
- Java / Android / Kotlin: `com.statsig:javasdk`, `com.statsig:serversdk`, `com.statsig:androidsdk`.
- Go: `github.com/statsig-io/go-sdk`.
- .NET: `Statsig` (NuGet).
- iOS / Swift: `Statsig` (CocoaPods, SwiftPM via `github.com/statsig-io/ios-sdk`).
- Erlang / Elixir: `statsig` (Hex).

## Initialization shapes

Common initialization patterns the agent will see in source:

- `statsig.initialize(sdkKey, user, options)` — `statsig-js`, `statsig-node`.
- `Statsig.initialize(sdkKey, user, options)` — older capitalization.
- `new StatsigClient(sdkKey, user, options).initializeAsync()` — `@statsig/js-client`.
- `new Statsig(sdkKey, options)` — `@statsig/js-server-core` style on the server.
- `<StatsigProvider sdkKey={…} user={…}>` — React tree provider (both old and new bindings).
- `<StatsigSynchronousProvider …>` — synchronous variant for SSR hydration.
- `statsig.initialize_client(sdk_key, user=…)` — Python.
- `Statsig.initialize(sdk_key)` — Ruby / Java / Go server SDKs.

## Feature-flag / gate API

- `statsig.checkGate(gateName)` — boolean gate evaluation. Old SDK.
- `client.checkGate(gateName)` — same, current SDK (client instance).
- `useGate(gateName)` — React hook; returns `{ value: boolean, … }` (current bindings) or `boolean` (old bindings).
- `useFeatureGate(gateName)` — alias in current bindings.
- `<Gate name={…} fallback={…}>` — React component.

## Dynamic config / experiment API

- `statsig.getConfig(configName)` — returns a `DynamicConfig` with `.get(key, fallback)` / `.getValue(key, fallback)`.
- `statsig.getExperiment(experimentName)` — returns a `DynamicConfig` (experiments are configs in Statsig's model).
- `statsig.getLayer(layerName)` — returns a `Layer` with `.get(param, fallback)`.
- `useConfig(name)`, `useExperiment(name)`, `useLayer(name)` — React hooks.

## Event logging API

- `statsig.logEvent(eventName, value?, metadata?)` — log an event. `value` is a number or string; `metadata` is a string-keyed dict.
- `client.logEvent({ eventName, value, metadata })` — current-SDK object form.

## User / identity API

- The Statsig user is supplied at initialization (`user = { userID, email, custom: { … } }`).
- `statsig.updateUser(user)` — re-evaluate with a new user.
- `client.updateUserAsync(user)` — current-SDK equivalent.
- The Statsig user object's `custom` dict is where arbitrary user properties live.

## Shutdown / flush

- `statsig.shutdown()` — flush queued events and tear down.
- `client.shutdown()` — current SDK.
- `statsig.flush()` — flush without shutdown.

## Notes on detection

A Statsig package in the manifest is not enough on its own, a project can list it with zero call sites. The robust signal is a Statsig package plus at least one of these: an initialization call, a gate or config or experiment or layer or event call, or a `StatsigProvider` JSX usage.
