# Migrate posthog-kmp from 0.x to 1.0.0

## Checklist

**During your upgrade**

- You construct `PostHogConfig(...)`, `CaptureOptions(...)`, or `SessionRecordingConfig(...)` with constructor arguments (in 0.x) rather than 1.0.0 DSL blocks
- You copy `beforeSend` events with `event.copy(properties = ...)` instead of `event.copy { properties = ... }`
- You use `PostHogConfig.apiKey` (removed in 1.0.0; 0.x uses `projectToken` or `apiKey`)
- You expect `captureScreenViews` to default to `false` (1.0.0 enables automatic screen views by default)
- You configure session replay with `sessionRecording = SessionRecordingConfig(...)` instead of `sessionReplay { ... }`
