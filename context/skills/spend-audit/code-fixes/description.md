# Spend audit — code fixes

`apply-code-fixes` edits the repository from the `code_change` of every finding
whose `fixed_in` is `pr`. Each edit is the smallest change that implements the
finding where it points. Nothing else changes: no reformatting, no renamed
symbols, no removed capture calls, no new dependencies.

Read the file before you edit it. Confirm the pattern the finding named is
there; when it is not, skip the finding and say why in your handoff. Never read
PostHog hosts or tokens into source as literals; they come from the environment
the project already uses.

## Shapes by SDK

**Browser (`posthog-js`)**, inside the existing `posthog.init(<token>, { ... })`
options object:

```js
person_profiles: 'identified_only',   // identify-person-profiles-mode
autocapture: false,                    // events-autocapture-share, or an allowlist:
autocapture: { element_allowlist: ['button', 'a'] },
capture_pageleave: false,              // events-pageleave
capture_heatmaps: false,               // events-heatmaps
before_send: (event) => {              // errors-noisy-issues
  if (event?.event === '$exception') {
    const types = event.properties?.$exception_types ?? []
    if (types.some((t) => NOISY_EXCEPTION_TYPES.includes(t))) return null
  }
  return event
},
```

Guarding identify (`identify-duplicate-per-session`):

```js
if (!posthog._isIdentified()) {
  posthog.identify(user.id, { email: user.email })
}
```

Or move the call into the login success handler and add `posthog.reset()` to
logout. When the project wraps PostHog in a provider or hook, edit the wrapper,
not every call site.

Gating on environment (`events-dev-hosts`, `errors-dev-hosts`):

```js
if (process.env.NODE_ENV === 'production') {
  posthog.init(/* unchanged */)
}
```

Use the project's own environment convention (`import.meta.env.PROD`,
`NEXT_PUBLIC_VERCEL_ENV === 'production'`, a Django `settings.DEBUG`). Do not
invent a new variable.

**Node (`posthog-node`)**:

```js
const client = new PostHog(process.env.POSTHOG_KEY, {
  host: process.env.POSTHOG_HOST,
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY, // flags-server-no-local-eval
  featureFlagsPollingInterval: 30000,                   // flags-polling-interval
})
client.capture({ distinctId, event, properties })      // flags-send-with-every-capture: no sendFeatureFlags: true
```

Add `POSTHOG_PERSONAL_API_KEY` to the environment through the wizard's env
tools when the project has an `.env.example`; never write a key value.

**Python (`posthog-python`)**: `personal_api_key=os.environ["POSTHOG_PERSONAL_API_KEY"]`,
`poll_interval=30`, remove `send_feature_flags=True` from `capture()`.

**Server identify on every request** (`identify-on-every-request`): keep one
`identify()` or `$set` at signup or login, replace the per-request call with
the plain `capture()` carrying `distinct_id` only.

**Mobile SDKs**: `personProfiles = .identifiedOnly` (iOS),
`personProfiles = PersonProfiles.IDENTIFIED_ONLY` (Android),
`person_profiles: 'identified_only'` (React Native). Replay sampling in mobile
config is a project setting first; only edit the client when the finding says
the code overrides it.

## Verify

Run the project's own typecheck, lint or build script when it defines one, on
the files you changed where the script allows it. Fix what your edit broke.
Do not run a project-wide formatter.

## Hand off

List every finding id you applied with `file` and a one-line description of the
edit, every id you skipped with the reason, and the verification you ran with
its outcome. The report writes the pull request body from this list.
