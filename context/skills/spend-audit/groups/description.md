# Spend audit — group analytics

Decide whether group analytics earns its add-on. You cannot see billing, so
you measure usage and let the product price the add-on.

Read `groupidentify` from the `measure-volumes` handoff, then list the group
type mappings and search insights for `aggregation_group_type_index` (queries
skill). Grep the code for `posthog\.group\(|groupIdentify\(|group_identify\(`
when it is connected.

| Check id                    | Condition                                                                                  | Finding                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groups-addon-unused`       | Group types are defined, `calls` is 0 in 30 days, and no insight aggregates by group       | `unpriced`, `billing_type: group_analytics`, `effort: billing`, `fixed_in: notebook`, `settings_path: /organization/billing`, `setting: "Turn off the Group analytics add-on"`. Tradeoff: group-level insights stop working if the team starts calling `group()` again. |
| `groups-identified-not-used`| `calls` > 0 but no insight aggregates by group                                             | `value`: the user pays and calls, but never looks. `events: ["$groupidentify"]` plus the group types seen. `value-insights` builds a group overview from it.                                                                                                             |
| `groups-duplicate-identify` | The same group key is identified many times per session with identical properties         | Measure with `SELECT $session_id, properties.$group_key, count() AS n FROM events WHERE event = '$groupidentify' AND timestamp > now() - INTERVAL 30 DAY GROUP BY 1, 2 HAVING n > 1`. Duplicates ≥ 5% of calls: `saving`, `product_analytics`/`events`, `before` = `calls`, `after.low` = distinct session-group pairs, `after.high` = `before - duplicates / 2`, `fixed_in: pr`, `code_change` = call `groupIdentify()` once per session or only when properties change. |
| `groups-in-use`             | Calls and insights both present                                                            | `passed`.                                                                                                                                                                                                                                                              |

Never propose removing `group()` or `groupIdentify()` calls. Group membership
on events is what makes the add-on useful once someone builds the insight.
