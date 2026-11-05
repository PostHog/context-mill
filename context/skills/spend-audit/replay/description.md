# Spend audit — session replay

Find recordings the project pays for and gets no value from. Read the project
replay settings through the project tool, `recording_durations` from the
`measure-volumes` handoff, and the watched share from the recordings list
(queries skill). Grep the code for `session_recording`, `disable_session_recording`,
`startSessionRecording|stopSessionRecording`, `maskAllInputs`,
`recordCrossOriginIframes`, `capturePerformance|recordBody|recordHeaders` when
it is connected.

Almost every fix here is a project setting, so almost every finding is
`fixed_in: notebook` with `settings_path: /project/<project id>/settings/project-replay`
and an exact `setting`. Never change a setting yourself.

| Check id                         | Condition                                                                                       | Finding                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `replay-minimum-duration`        | `session_recording_minimum_duration_milliseconds` is null or under 5000 and `under_10s / recordings` ≥ 20% | `saving`, `session_replay`/`recordings` (`mobile_replay`/`mobile_recordings` when `snapshot_source` is mobile), `before` = `recordings`, `after.low` = `recordings - under_10s`, `after.high` = `recordings - under_5s`. `setting: "Minimum duration: 10000 ms"` (5000 when the under-10s share is small). Tight range: the setting removes exactly those recordings. Tradeoff: short visits leave no replay to attach to a support ticket. |
| `replay-no-sampling`             | `session_recording_sample_rate` is null or 1 and `recordings` ≥ 20,000 a month, with no URL or event trigger and no linked flag | `saving`, `session_replay`/`recordings`, `before` = `recordings` after the minimum-duration finding is applied (do not double count: use `after.low` of that finding as this `before` when both apply), `after.low` = `after.high` = `before * 0.5` for a 50% sample. `setting: "Sample rate: 50%"`. Tradeoff: half the sessions have no replay, including some a support ticket asks for. |
| `replay-no-triggers`             | Recording is on for every page, and `recordings` ≥ 20,000 a month, and the watched share is under 2%     | `unpriced`, `effort: setting`, `setting: "Record only on <the URLs or events the team watches>"`. Pair it with the watched share in `evidence`. You cannot measure how many recordings a trigger keeps, so do not size it. |
| `replay-no-activity`             | `no_activity / recordings` ≥ 20%                                                                | Fold into `replay-minimum-duration`'s evidence (recordings with no activity are mostly short). Do not size separately. |
| `replay-network-payloads`        | `session_recording_network_payload_capture_config` records request or response bodies            | `unpriced`, `effort: setting`, `setting: "Turn off request and response body capture"`. Bodies cost storage and risk PII; recordings count stays the same, so no saving. |
| `replay-console-logs`            | `capture_console_log_opt_in` is true and console logs are never searched (you cannot tell)       | Skip. Not measurable, and the value is real for debugging. |
| `replay-client-config`           | The browser init sets `session_recording` options that contradict the project settings           | `unpriced`, `effort: code`, `fixed_in: pr`: the code wins over the setting, so note what to change. |
| `replay-unwatched`               | Watched share under 5% over the sampled recent recordings                                        | `unpriced`, `effort: setting`, `fixed_in: notebook`, `setting: "Use Replay Vision scanners so unwatched recordings still produce findings, or tighten triggers"`. Evidence: the share and the sample size. |
| `replay-fine`                    | Minimum duration, sampling or triggers are set and the watched share is reasonable              | `passed`. |

Report `before` and `after` in recordings, never in `$snapshot` events.
