# Legacy library page snapshots

Copies of the posthog.com library pages for the SDK majors that speak the
legacy capture API, taken on 2026-11-02 from the `.md` endpoints in the table below. File names
match the page names so the generated references keep their names. The `integration` variants for these SDKs read the copies
instead of the live pages, because the live pages move to the capture v1
majors (posthog-python 8, posthog-node 6, posthog-go v2, posthog-rs 1,
posthog-ios 4, posthog-android 4, posthog_flutter 6) on each SDK's release day
and the legacy variants must keep describing the majors they install.

Refresh a copy only to pick up a fix to the legacy page itself, never from a
page that already describes a v1 major. The v1 variants point at the live pages.

`feature-flags/` holds the two feature flag pages the Android variants read,
taken on 2026-11-04 while they still described posthog-android 3.x. The
`adding-feature-flag-code` page is a group `shared_docs` entry that every other
variant keeps reading live: a variant's own `shared_docs` entry replaces the
group's one with the same file name.

The iOS pages in `feature-flags/`, `error-tracking/` and `logs-installation/`
were taken on 2026-11-05 while they still described posthog-ios 3.x
(CocoaPods, `from: "3.56.0"`, `"3.59.3"` for logs). The iOS flag variants also read the
`adding-feature-flag-code` snapshot, which still has the 3.x
`reloadFeatureFlags` block and the `didReceiveFeatureFlags` fallback. The logs
folder isn't named `logs/` because `.gitignore` ignores that name.

The Android error tracking, logs and upload mappings pages and the Flutter
feature flag, error tracking and logs install pages were taken on 2026-11-06
while they still described posthog-android 3.x (`posthog-android:3.+`, `apiKey`)
and posthog_flutter 5.x (`^5.x`). They reuse the product analytics onboarding
steps that the 4.0 and 6.0 onboarding changes rewrite.

| File | Source |
| --- | --- |
| `python.md` | https://posthog.com/docs/libraries/python.md |
| `posthog-python.md` | https://posthog.com/docs/references/posthog-python.md |
| `node.md` | https://posthog.com/docs/libraries/node.md |
| `posthog-node.md` | https://posthog.com/docs/references/posthog-node.md |
| `go.md` | https://posthog.com/docs/libraries/go.md |
| `rust.md` | https://posthog.com/docs/libraries/rust.md |
| `ios.md` | https://posthog.com/docs/libraries/ios.md |
| `usage.md` | https://posthog.com/docs/libraries/ios/usage.md |
| `configuration.md` | https://posthog.com/docs/libraries/ios/configuration.md |
| `android.md` | https://posthog.com/docs/libraries/android.md |
| `flutter.md` | https://posthog.com/docs/libraries/flutter.md |
| `django.md` | https://posthog.com/docs/libraries/django.md |
| `flask.md` | https://posthog.com/docs/libraries/flask.md |
| `feature-flags/android.md` | https://posthog.com/docs/feature-flags/installation/android.md |
| `feature-flags/adding-feature-flag-code.md` | https://posthog.com/docs/feature-flags/adding-feature-flag-code.md |
| `feature-flags/ios.md` | https://posthog.com/docs/feature-flags/installation/ios.md |
| `error-tracking/ios.md` | https://posthog.com/docs/error-tracking/installation/ios.md |
| `logs-installation/ios.md` | https://posthog.com/docs/logs/installation/ios.md |
| `error-tracking/android.md` | https://posthog.com/docs/error-tracking/installation/android.md |
| `logs-installation/android.md` | https://posthog.com/docs/logs/installation/android.md |
| `upload-mappings/android.md` | https://posthog.com/docs/error-tracking/upload-mappings/android.md |
| `feature-flags/flutter.md` | https://posthog.com/docs/feature-flags/installation/flutter.md |
| `error-tracking/flutter.md` | https://posthog.com/docs/error-tracking/installation/flutter.md |
| `logs-installation/flutter.md` | https://posthog.com/docs/logs/installation/flutter.md |
