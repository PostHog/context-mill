# Spend audit — identify and person profiles

Checks for `$identify`, `$set` and person-profile usage. Read the
`measure-volumes` handoff first; it holds `identify_per_session` and
`anonymous_vs_identified`. Scan the code only when your input says the code is
connected.

Code patterns to grep: `posthog\.identify\(`, `\.identify\(`,
`_isIdentified\(|isIdentified\(`, `posthog\.reset\(`, `person_profiles`,
`posthog\.init\(|new PostHog\(|Posthog\(`, `\$set|setPersonProperties`.

| Check id                           | What                                                                         | Measure                                                                                 | Finding                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identify-duplicate-per-session`   | `identify()` fires several times per session (every page load, every render) | `identify_per_session`: `duplicate_identify_events`, share of sessions with duplicates | Share ≥ 5%: `saving`, `product_analytics`/`events`, `before` = `identify_events`, `after.low` = `sessions_with_identify`, `after.high` = `before - duplicate_identify_events / 2`. `fixed_in: pr`, `code_change` = guard every identify site with `_isIdentified()` or move it to the login handler. Below 5%: `passed`. |
| `identify-person-profiles-mode`    | Anonymous visitors get a person profile they never need                      | `anonymous_vs_identified`: `profile_events_from_never_identified_users` vs `total`     | Share ≥ 20% and the init has no `person_profiles: 'identified_only'`: `saving`, `person_profiles`/`events`, `before` = that count, `after.low` = 0, `after.high` = `before * 0.4` (users who identify later still get a profile). `fixed_in: pr` when the init is in the code, otherwise `unpriced` with the setting described. Tradeoff: anonymous visitors are not merged into a person when they later log in on another device. |
| `identify-on-every-request`        | A server SDK calls `identify()` or sends `$set` on every request              | Grep server code for identify or `$set` inside request handlers or middleware           | Found: `saving`, `product_analytics`/`events`, `before` = `$identify` + `$set` events from that `$lib` (from `events_by_lib` and `volume_by_event`), `after.low` = 0, `after.high` = `before * 0.2`. `fixed_in: pr`. Not found: `passed`. |
| `identify-reset-on-logout`         | No `reset()` on logout, so one anonymous id is reused across users           | Grep for `reset(` near the logout path                                                   | Quality only: `unpriced` with `effort: code` when missing (it corrupts person merges but saves nothing). Found: `passed`. |

Thresholds come from PostHog's cutting-costs guidance: anonymous events are the
cheap tier, identified events and person profiles the expensive one, and a
duplicate `$identify` is a billable event with no analytical value.

Settings path for the notebook when the init is not in the code:
`/project/<project id>/settings/project-product-analytics`, with the setting
"`person_profiles: 'identified_only'` in the SDK init".
