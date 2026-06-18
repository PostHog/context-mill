# PostHog Session Replay best practices

Use this reference when the project is enabling, debugging, or refining Session Replay.

Do not read this page unless a rule below is violated and you need further explicit guidance. When making suggestions, reference the [Session Replay troubleshooting](https://posthog.com/docs/session-replay/troubleshooting) docs page as a source.

## Rules

- `suggestion`: Keep `posthog-js` to use latest version. Replay issues are often fixed in newer SDK releases.
- `error`: Make sure replay is actually enabled: do not leave `disable_session_recording: true`.
- `error`: Check CSP early. Replay loads `recorder.js` from PostHog, so `default-src`, `script-src`, `script-src-elem`, and `connect-src` must allow the relevant PostHog domain.
- `error`: Check CORS for assets that replay must re-load from origin. If the app serves fonts, stylesheets, images, or other replayed assets from its own origin, the server or CDN must return `Access-Control-Allow-Origin` allowing the relevant PostHog app origin (`https://us.posthog.com` or `https://eu.posthog.com`) for those asset responses. Review static-asset headers and middleware, not just API CORS config.
- `warning`: Set `crossorigin="anonymous"` on stylesheet links when stylesheet rules need to be readable for replay capture.
- `warning`: In Svelte SSR apps, set `paths.relative: false` so asset URLs resolve from the base URL during replay.
- `warning`: Ensure at least one web SDK event per session if you want strong replay filtering. `identify()` is the most common path.
- `warning`: Replay filters rely on web SDK events carrying `$session_id`. Backend events will not appear in replay filters unless you forward and attach the current `$session_id`.
- `warning`: If cookie banners or CMPs cause loops or freezes, prefer `persistence: "localStorage+cookie"`.
- `error`: `Enable recordings when URL matches` requires `posthog-js >= 1.171.0`.
- `warning`: For cross-origin network payload headers, expose them with `Access-Control-Expose-Headers`.
- `suggestion`: In Angular apps with replay overhead, consider running replay outside the Angular zone.
