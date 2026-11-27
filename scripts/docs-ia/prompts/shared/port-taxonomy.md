## Typed cross-boundary port taxonomy

Attach `port` (or `ports`) on every fact that crosses a system, storage, or framework seam:

- `http` (`emit|handle|guard`): `"METHOD /path/{}/..."` or `"* /api/projects/*"`
- `event` (`emit|handle`): exact event name (e.g. `"survey sent"`) or `"*"`
- `store` (`write|read`): `"<kind>:<key>"` where `<kind>` is `model|hypercache|redis|localStorage|sessionStorage|UserDefaults|SharedPreferences|person_prop|cache`
- `model_hook` (`emit|handle`): `"<Model>:<pre_save|post_save|pre_delete|post_delete|m2m_changed>"`
- `task` (`emit|handle`): `"<task_name>"` or `"beat:<schedule_key>"`
- `query` (`emit|handle`): `"hogql:<runner_or_table>"`
- `sdk_hook` (`emit|handle`): `"<sdk>:<hook>"`
- `ui_nav` (`emit|handle`): `"route:<path>|panel:<name>|modal:<name>|action:<logic>.<act>"`
- `mcp` (`emit|handle|guard`): `"tool:<tool_name>"` or `"*"`
- `external` (`emit`): `"<vendor>:<target>"`
