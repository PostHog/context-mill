// 5 Deliberately Hard Planted PRs (H1..H5, with H5a human .mdx restructure + H5b code change)
// generated programmatically against the exact post-E24 repository commits so every unified diff
// and post-PR file body is 100% syntactically authentic against real PostHog source code.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const POST_E24_COMMITS = {
  posthog: '91a8bcf9d9cb9b2bdf972368547028f8e5d76442', // E23
  'posthog-js': '4d0681fc2843c1299bf3955884dbcb4944518f74', // E17
  'posthog-python': '778f386eaacd1ea9379852c3b032a9f19a6271ea', // E09
  'posthog-rs': '98d2bf1b6186e9461efa70977f1a28f5dca34899', // E10
  'posthog-com': 'a0eeda34da6c748df0fc1a909f902fe6b6fd8977', // E24
};

function readGitBlob(repoDir, ref, relPath) {
  return execFileSync('git', ['-C', repoDir, 'show', `${ref}:${relPath}`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function replaceExact(src, target, replacement, label) {
  if (!src.includes(target)) {
    throw new Error(`Planted diff target not found for ${label}:\n${target.slice(0, 200)}`);
  }
  return src.replace(target, replacement);
}

function makeUnifiedDiff(relPath, beforeText, afterText) {
  const dir = mkdtempSync(join(tmpdir(), 'planted-diff-'));
  try {
    const aPath = join(dir, 'before');
    const bPath = join(dir, 'after');
    writeFileSync(aPath, beforeText ?? '');
    writeFileSync(bPath, afterText ?? '');
    const aLabel = beforeText === null ? '/dev/null' : `a/${relPath}`;
    const bLabel = afterText === null ? '/dev/null' : `b/${relPath}`;
    try {
      return execFileSync('diff', ['-u', '--label', aLabel, '--label', bLabel, aPath, bPath], {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch (err) {
      if (err.status === 1 && typeof err.stdout === 'string') {
        const header = `diff --git a/${relPath} b/${relPath}\n`;
        return header + err.stdout;
      }
      throw err;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function buildFileEntry(repoDir, ref, relPath, transformFn, label) {
  const before = readGitBlob(repoDir, ref, relPath);
  const after = transformFn(before);
  const diff = makeUnifiedDiff(relPath, before, after);
  return {
    status: after === null ? 'D' : 'M',
    path: relPath,
    oldPath: relPath,
    text: after,
    diff,
    label,
  };
}

/**
 * Build the 6 chronological planted events (H1, H2, H3, H4, H5a human .mdx restructure, H5b code PR)
 * plus a virtual docs snapshot map for H5a.
 */
export function buildPlantedHardEvents(repoDirs) {
  // ── H1: Cross-SDK silent default flip under an opaque refactor title ──
  const h1Types = buildFileEntry(
    repoDirs['posthog-python'],
    POST_E24_COMMITS['posthog-python'],
    'posthog/mcp/types.py',
    src =>
      replaceExact(
        src,
        '    # Capture the model from recognized client metadata, falling back to an\n' +
          '    # SDK-injected llm_model argument. On by default; False disables capture.\n' +
          '    capture_model: Union[bool, MCPAnalyticsModelOptions] = True',
        '    # Capture the model from recognized client metadata, falling back to an\n' +
          '    # SDK-injected llm_model argument. Off by default; True enables capture.\n' +
          '    capture_model: Union[bool, MCPAnalyticsModelOptions] = False',
        'H1 types.py'
      ),
    'H1 types.py'
  );
  const h1Ownership = buildFileEntry(
    repoDirs['posthog-python'],
    POST_E24_COMMITS['posthog-python'],
    'posthog/mcp/_argument_ownership.py',
    src =>
      replaceExact(
        src,
        '    if is_capture_model_enabled(options.capture_model):\n' +
          '        enabled.add("llm_model")',
        '    if bool(options.capture_model) and is_capture_model_enabled(options.capture_model):\n' +
          '        enabled.add("llm_model")',
        'H1 _argument_ownership.py'
      ),
    'H1 _argument_ownership.py'
  );

  // ── H2: Deep backend HogQL harness precedence change + protocol baseline bump (zero frontend/docs cues) ──
  const h2Harness = buildFileEntry(
    repoDirs.posthog,
    POST_E24_COMMITS.posthog,
    'products/mcp_analytics/backend/mcp_harness.py',
    src =>
      replaceExact(
        src,
        '_RAW_TOKEN = f"""coalesce(\n' +
          '    multiIf(\n' +
          '        -- The header is captured verbatim and its value arrives in both spellings\n' +
          "        -- ('ClaudeCode' and 'claude-code'), so each vendor matches both.\n" +
          "        {_VENDOR} IN ('claudecode', 'claude-code'), 'claude-code',\n" +
          "        {_VENDOR} IN ('claudeai', 'claude-ai'), 'claude-ai',\n" +
          "        {_VENDOR} = 'cowork', 'cowork',\n" +
          "        {_VENDOR} IN ('claudedesign', 'claude-design'), 'claude-design',\n" +
          "        {_VENDOR} IN ('claudeartifacts', 'claude-artifacts'), 'claude-artifacts',\n" +
          '        NULL\n' +
          '    ),\n' +
          "    if(lower({_UA_PRODUCT}) = 'claude-code', {_UA_TOKEN}, NULL),\n" +
          "    -- The Wizard runs on pi and reports pi-mcp's `pi-mcp-posthog`. Its UA product\n" +
          '    -- token is the bare "posthog", which PostHog\'s SDKs share, so match the full prefix.\n' +
          "    if(startsWith(lower(toString(properties.$mcp_client_user_agent)), 'posthog/wizard'), 'posthog-wizard', NULL),\n" +
          '    if({_UA_FIRST}, {_UA_TOKEN}, NULL),\n' +
          "    nullIf(nullIf(toString(properties.$mcp_client_name), ''), 'mcp'),\n" +
          "    nullIf({_UA_TOKEN}, ''),\n" +
          "    ''\n" +
          ')"""',
        '_RAW_TOKEN = f"""coalesce(\n' +
          '    -- Explicit clientInfo.name now takes top precedence over vendor headers and User-Agent.\n' +
          "    nullIf(nullIf(toString(properties.$mcp_client_name), ''), 'mcp'),\n" +
          '    multiIf(\n' +
          '        -- The header is captured verbatim and its value arrives in both spellings\n' +
          "        -- ('ClaudeCode' and 'claude-code'), so each vendor matches both.\n" +
          "        {_VENDOR} IN ('claudecode', 'claude-code'), 'claude-code',\n" +
          "        {_VENDOR} IN ('claudeai', 'claude-ai'), 'claude-ai',\n" +
          "        {_VENDOR} = 'cowork', 'cowork',\n" +
          "        {_VENDOR} IN ('claudedesign', 'claude-design'), 'claude-design',\n" +
          "        {_VENDOR} IN ('claudeartifacts', 'claude-artifacts'), 'claude-artifacts',\n" +
          '        NULL\n' +
          '    ),\n' +
          "    if(lower({_UA_PRODUCT}) = 'claude-code', {_UA_TOKEN}, NULL),\n" +
          "    -- The Wizard runs on pi and reports pi-mcp's `pi-mcp-posthog`. Its UA product\n" +
          '    -- token is the bare "posthog", which PostHog\'s SDKs share, so match the full prefix.\n' +
          "    if(startsWith(lower(toString(properties.$mcp_client_user_agent)), 'posthog/wizard'), 'posthog-wizard', NULL),\n" +
          '    if({_UA_FIRST}, {_UA_TOKEN}, NULL),\n' +
          "    nullIf({_UA_TOKEN}, ''),\n" +
          "    ''\n" +
          ')"""',
        'H2 mcp_harness.py'
      ),
    'H2 mcp_harness.py'
  );
  const h2Proto = buildFileEntry(
    repoDirs.posthog,
    POST_E24_COMMITS.posthog,
    'products/mcp_analytics/backend/hogql_queries/protocol_version_breakdown.py',
    src =>
      replaceExact(
        src,
        'CURRENT_PROTOCOL_VERSION = "2026-07-28"',
        'CURRENT_PROTOCOL_VERSION = "2026-11-01"',
        'H2 protocol_version_breakdown.py'
      ),
    'H2 protocol_version_breakdown.py'
  );

  // ── H3: Silent feature deletion & deprecation across 4 docs pages + Dewey tombstone audit trail ──
  const h3Types = buildFileEntry(
    repoDirs['posthog-js'],
    POST_E24_COMMITS['posthog-js'],
    'packages/mcp/src/types.ts',
    src => {
      let next = replaceExact(
        src,
        '  /** Enable the `get_more_tools` virtual tool so agents can report missing functionality. */\n' +
          '  reportMissing?: boolean\n',
        '',
        'H3 types.ts MCPAnalyticsOptions.reportMissing'
      );
      next = replaceExact(
        next,
        '  /**\n' +
          '   * Rename the `get_more_tools` virtual tool (the `reportMissing` feature).\n' +
          '   * Defaults to `get_more_tools`. Set once here so the tool is advertised and\n' +
          '   * detected under the same name.\n' +
          '   */\n' +
          '  missingCapabilityToolName?: string\n',
        '',
        'H3 types.ts MCPAnalyticsOptions.missingCapabilityToolName'
      );
      next = replaceExact(
        next,
        '  /**\n' +
          '   * Append the `get_more_tools` virtual tool so agents can report a missing\n' +
          '   * capability. Defaults to `false`. When the agent calls it, route the call to\n' +
          '   * {@link PostHogMCP.captureMissingCapability} and reply with `getMoreToolsResult()`.\n' +
          '   */\n' +
          '  reportMissing?: boolean',
        '  /** Replaced by `collectFeedback` (`send_feedback` / `$mcp_feedback`); legacy `reportMissing` was removed. */',
        'H3 types.ts PrepareToolListOptions.reportMissing'
      );
      return next;
    },
    'H3 types.ts'
  );
  const h3Tools = buildFileEntry(
    repoDirs['posthog-js'],
    POST_E24_COMMITS['posthog-js'],
    'packages/mcp/src/extensions/tools.ts',
    () => null,
    'H3 tools.ts deletion'
  );

  // ── H4: Large behavior-preserving refactor trap (0 customer-visible changes!) ──
  const h4Events = buildFileEntry(
    repoDirs['posthog-js'],
    POST_E24_COMMITS['posthog-js'],
    'packages/mcp/src/extensions/posthog-events.ts',
    src =>
      replaceExact(
        src,
        "function getDistinctId(event: Event): string {\n" +
          "  return event.identifyActorGivenId || event.sessionId || 'anonymous'\n" +
          "}\n\n" +
          "function getTimestamp(event: Event): string {\n" +
          "  return event.timestamp ? event.timestamp.toISOString() : new Date().toISOString()\n" +
          "}",
        "// Internal helpers extracted for readability; wire format and fallback order are unchanged.\n" +
          "function resolveEventDistinctId(event: Event): string {\n" +
          "  const actorId = event.identifyActorGivenId\n" +
          "  if (actorId) return actorId\n" +
          "  const sessionId = event.sessionId\n" +
          "  if (sessionId) return sessionId\n" +
          "  return 'anonymous'\n" +
          "}\n\n" +
          "function getDistinctId(event: Event): string {\n" +
          "  return resolveEventDistinctId(event)\n" +
          "}\n\n" +
          "function resolveEventTimestampIso(event: Event): string {\n" +
          "  const raw = event.timestamp\n" +
          "  return raw ? raw.toISOString() : new Date().toISOString()\n" +
          "}\n\n" +
          "function getTimestamp(event: Event): string {\n" +
          "  return resolveEventTimestampIso(event)\n" +
          "}",
        'H4 posthog-events.ts'
      ),
    'H4 posthog-events.ts'
  );
  const h4Types = buildFileEntry(
    repoDirs['posthog-js'],
    POST_E24_COMMITS['posthog-js'],
    'packages/mcp/src/types.ts',
    src =>
      replaceExact(
        src,
        'export interface McpCaptureCommon {\n' +
          '  /**\n' +
          '   * Resolved person distinct id (becomes `distinct_id`). Supplying it enables\n' +
          '   * person processing so `$set` lands on a real person; omitting it falls back\n' +
          '   * to an anonymous capture with `$process_person_profile: false`.\n' +
          '   */\n' +
          '  distinctId?: string\n' +
          '  /** Session id → `$session_id`. Omitted from the event entirely when not provided. */\n' +
          '  sessionId?: string',
        '/** Internal alias for MCP protocol revision strings; wire format unchanged. */\n' +
          'type McpProtocolRevisionString = string\n\n' +
          'export interface McpCaptureCommon {\n' +
          '  /** Session id → `$session_id`. Omitted from the event entirely when not provided. */\n' +
          '  sessionId?: string\n' +
          '  /**\n' +
          '   * Resolved person distinct id (becomes `distinct_id`). Supplying it enables\n' +
          '   * person processing so `$set` lands on a real person; omitting it falls back\n' +
          '   * to an anonymous capture with `$process_person_profile: false`.\n' +
          '   */\n' +
          '  distinctId?: string',
        'H4 types.ts McpCaptureCommon'
      ),
    'H4 types.ts'
  );

  // ── H5a: Uncooperative human .mdx restructure of identifying-users.mdx (shifts lines +28, renames headings) ──
  const origIdentifyingUsers = readGitBlob(
    repoDirs['posthog-com'],
    POST_E24_COMMITS['posthog-com'],
    'contents/docs/mcp-analytics/identifying-users.mdx'
  );
  const restructuredIdentifyingUsers = replaceExact(
    origIdentifyingUsers,
    '---\ntitle: Identifying users\n---\n\n' +
      'By default, the SDK attributes events to a generated session ID (`ses_…`), not to a person. Use `identify` to associate calls with a person.\n\n' +
      '## How attribution works\n\n' +
      'For each event, the SDK picks `distinct_id` in this order:\n\n' +
      '1. The distinct ID returned by your `identify` callback, if it returned an identity.\n' +
      '2. The MCP session id (`ses_…`).\n' +
      '3. The literal string `"anonymous"`.\n\n' +
      'Before `identify` returns a user, events use the session ID. Later events use the user ID. See [Events before identification](#events-before-identification) for what happens to the earlier events.',
    '---\ntitle: Identifying users\n---\n\n' +
      'By default, the SDK attributes events to a generated session ID (`ses_…`), not to a person. Use `identify` to associate calls with a person.\n\n' +
      '## Quick summary\n\n' +
      '| Auth pattern | Recommended `identify` setup | Person profile created? |\n' +
      '| --- | --- | --- |\n' +
      '| Per-user OAuth / bearer token | Return `UserIdentity` from request headers | Yes |\n' +
      '| Multi-tenant API key | Return account or org-scoped user ID | Yes |\n' +
      '| Internal single-tenant tool | Leave `identify` unset | No (session-scoped) |\n' +
      '| Public / bot traffic | Return `null` when unauthenticated | No (session-scoped) |\n\n' +
      '<CalloutBox icon="IconInfo" title="When to configure identification" type="fyi">\n\n' +
      'Wire up `identify` early in your MCP server middleware so the first request in a session carries person identity rather than falling back to a session-only distinct ID.\n\n' +
      '</CalloutBox>\n\n' +
      'Keep person profiles clean by returning `null` whenever a request lacks verified credentials. Never synthesize fake placeholder IDs for unauthenticated clients.\n\n' +
      '## Identity precedence and fallback rules\n\n' +
      'For each event, the SDK picks `distinct_id` in this order:\n\n' +
      '1. The distinct ID returned by your `identify` callback, if it returned an identity.\n' +
      '2. The MCP session id (`ses_…`).\n' +
      '3. The literal string `"anonymous"`.\n\n' +
      'Before `identify` returns a user, events use the session ID. Later events use the user ID. See [Events before identification](#events-before-identification) for what happens to the earlier events.',
    'H5a identifying-users.mdx'
  );

  // ── H5b: Subtle upstream Python SDK fallback break right after H5a moved the prose ──
  const h5Events = buildFileEntry(
    repoDirs['posthog-python'],
    POST_E24_COMMITS['posthog-python'],
    'posthog/mcp/_posthog_events.py',
    src =>
      replaceExact(
        src,
        'def _get_distinct_id(event: Event) -> str:\n' +
          '    return (\n' +
          '        event.get("identify_actor_given_id") or event.get("session_id") or "anonymous"\n' +
          '    )',
        'def _get_distinct_id(event: Event) -> str:\n' +
          '    server_slug = (event.get("server_name") or "default").strip() or "default"\n' +
          '    return (\n' +
          '        event.get("identify_actor_given_id")\n' +
          '        or event.get("session_id")\n' +
          '        or f"mcp-anon-{server_slug}"\n' +
          '    )',
        'H5b _posthog_events.py'
      ),
    'H5b _posthog_events.py'
  );
  const h5Instr = buildFileEntry(
    repoDirs['posthog-python'],
    POST_E24_COMMITS['posthog-python'],
    'posthog/mcp/_instrumentation.py',
    src =>
      replaceExact(
        src,
        '    await handle_identify(data, session_id, request, extra)',
        '    # Python SDK now scopes unidentified sessionless events to `mcp-anon-<server_name>`\n' +
          '    # (defaulting to `mcp-anon-default`) instead of the legacy literal `"anonymous"` fallback.\n' +
          '    await handle_identify(data, session_id, request, extra)',
        'H5b _instrumentation.py'
      ),
    'H5b _instrumentation.py'
  );

  function toPrData(repo, commit, parent, body, entries) {
    const diffByPath = {};
    const files = entries.map(e => {
      diffByPath[e.path] = e.diff;
      return { status: e.status, path: e.path, oldPath: e.oldPath, text: e.text };
    });
    return { repo, commit, parent, body, files, diffByPath };
  }

  const events = [
    {
      id: 'H1',
      suite: 'planted_hard',
      date: '2026-11-24',
      kind: 'code_pr',
      repo: 'posthog-python',
      prNumber: 1401,
      commit: 'planted-h1-capture-model-default-false',
      title: 'refactor(mcp): simplify argument ownership defaults in Python helper (#1401)',
      category: 'planted_cross_sdk_silent_default_flip',
      truthNeedsDocs: true,
      truthChangeKind: 'update',
      truthPages: [
        'contents/docs/mcp-analytics/installation/python.mdx',
        'contents/docs/mcp-analytics/start-here.mdx',
        'contents/docs/mcp-analytics/privacy.mdx',
      ],
      truthNeedsIaUpdate: true,
      notes: 'Planted H1: Opaque refactor title flips capture_model default True -> False in Python SDK, contradicting installation/python.mdx options table, start-here.mdx L152+L265 ("Every SDK has the same defaults"), and privacy.mdx L26 ("Model capture and conversation IDs are enabled by default") — the latter two never mention the identifier capture_model.',
      prData: toPrData(
        'posthog-python',
        'planted-h1-capture-model-default-false',
        POST_E24_COMMITS['posthog-python'],
        'Align argument ownership guards and make model capture opt-in on Python MCP servers to avoid unexpected tool-schema mutations by default.',
        [h1Types, h1Ownership]
      ),
      assertions: [
        {
          id: 'h1_python_default_false',
          page: 'contents/docs/mcp-analytics/installation/python.mdx',
          description: 'Updates capture_model default from True to False in installation/python.mdx',
          check: diff => /\+.*capture_model.*False/i.test(diff) || /\+.*`False`/.test(diff),
        },
        {
          id: 'h1_start_here_same_defaults_fixed',
          page: 'contents/docs/mcp-analytics/start-here.mdx',
          description: 'Fixes start-here.mdx L152 ("Every SDK has the same defaults") where capture_model is never named',
          check: diff => /-Every SDK has the same defaults/i.test(diff),
        },
        {
          id: 'h1_privacy_default_fixed',
          page: 'contents/docs/mcp-analytics/privacy.mdx',
          description: 'Fixes privacy.mdx L26 ("Model capture and conversation IDs are enabled by default") where capture_model is never named',
          check: diff => /-Model capture and conversation IDs are enabled by default/i.test(diff),
        },
      ],
    },
    {
      id: 'H2',
      suite: 'planted_hard',
      date: '2026-11-24',
      kind: 'code_pr',
      repo: 'posthog',
      prNumber: 140201,
      commit: 'planted-h2-harness-precedence-and-proto',
      title: 'chore(mcp-analytics): reorder client signal precedence and bump dated spec baseline (#140201)',
      category: 'planted_deep_backend_hogql_seam',
      truthNeedsDocs: true,
      truthChangeKind: 'update',
      truthPages: ['contents/docs/mcp-analytics/events.mdx'],
      truthNeedsIaUpdate: true,
      notes: 'Planted H2: Deep backend HogQL change (zero frontend/docs cues) moves $mcp_client_name ahead of $mcp_vendor_client and bumps CURRENT_PROTOCOL_VERSION to 2026-11-01.',
      prData: toPrData(
        'posthog',
        'planted-h2-harness-precedence-and-proto',
        POST_E24_COMMITS.posthog,
        'Update HogQL harness resolution SQL and current dated protocol version constant.',
        [h2Harness, h2Proto]
      ),
      assertions: [
        {
          id: 'h2_events_client_name_first',
          page: 'contents/docs/mcp-analytics/events.mdx',
          description: 'Reorders $mcp_client_name ahead of $mcp_vendor_client in events.mdx harness resolution',
          check: diff => /\+.*1\.\s*`?\$mcp_client_name`?/i.test(diff) || /\+.*\$mcp_client_name.*first/i.test(diff),
        },
      ],
    },
    {
      id: 'H3',
      suite: 'planted_hard',
      date: '2026-11-25',
      kind: 'code_pr',
      repo: 'posthog-js',
      prNumber: 5890,
      commit: 'planted-h3-remove-report-missing',
      title: 'chore(mcp): remove legacy get_more_tools virtual tool path (#5890)',
      category: 'planted_silent_feature_deletion_5_pages',
      truthNeedsDocs: true,
      truthChangeKind: 'update',
      truthPages: [
        'contents/docs/mcp-analytics/installation/typescript.mdx',
        'contents/docs/mcp-analytics/installation/index.mdx',
        'contents/docs/mcp-analytics/missing-capability.mdx',
        'contents/docs/mcp-analytics/start-here.mdx',
        'contents/docs/mcp-analytics/queries.mdx',
      ],
      truthNeedsIaUpdate: true,
      notes: 'Planted H3: Removes reportMissing / missingCapabilityToolName and deletes packages/mcp/src/extensions/tools.ts in @posthog/mcp, retiring Dewey leaves and contradicting 5 separate docs pages that explicitly advertise TypeScript reportMissing / get_more_tools.',
      prData: toPrData(
        'posthog-js',
        'planted-h3-remove-report-missing',
        POST_E24_COMMITS['posthog-js'],
        'Remove legacy reportMissing / get_more_tools virtual tool support from @posthog/mcp now that collectFeedback (send_feedback / $mcp_feedback) supersedes it.',
        [h3Types, h3Tools]
      ),
      assertions: [
        {
          id: 'h3_ts_install_updated',
          page: 'contents/docs/mcp-analytics/installation/typescript.mdx',
          description: 'Removes or updates reportMissing/missingCapabilityToolName on installation/typescript.mdx',
          check: diff => /-.*(reportMissing|missingCapabilityToolName)/i.test(diff),
        },
        {
          id: 'h3_install_index_matrix_updated',
          page: 'contents/docs/mcp-analytics/installation/index.mdx',
          description: 'Updates TypeScript column in installation/index.mdx support matrix for get_more_tools',
          check: diff => /-.*get_more_tools/i.test(diff) && /\+.*(No|collectFeedback|send_feedback|removed)/i.test(diff),
        },
        {
          id: 'h3_missing_cap_updated',
          page: 'contents/docs/mcp-analytics/missing-capability.mdx',
          description: 'Updates TypeScript guidance in missing-capability.mdx to collectFeedback / send_feedback',
          check: diff => /\+.*(collectFeedback|send_feedback|\$mcp_feedback|removed)/i.test(diff),
        },
        {
          id: 'h3_start_here_updated',
          page: 'contents/docs/mcp-analytics/start-here.mdx',
          description: 'Updates TypeScript snippet in start-here.mdx off removed reportMissing',
          check: diff => /\+.*(collectFeedback|send_feedback|\$mcp_feedback)/i.test(diff),
        },
        {
          id: 'h3_queries_updated',
          page: 'contents/docs/mcp-analytics/queries.mdx',
          description: 'Updates queries.mdx L114 heading off removed TS reportMissing: true',
          check: diff => /-.*reportMissing/i.test(diff),
        },
      ],
    },
    {
      id: 'H4',
      suite: 'planted_hard',
      date: '2026-11-25',
      kind: 'code_pr',
      repo: 'posthog-js',
      prNumber: 5891,
      commit: 'planted-h4-behavior-preserving-refactor',
      title: 'refactor(mcp): modernize capture event builders and tighten type aliases (#5891)',
      category: 'planted_refactor_false_positive_trap',
      truthNeedsDocs: false,
      truthChangeKind: null,
      truthPages: [],
      truthNeedsIaUpdate: false,
      notes: 'Planted H4: Large tempting diff touching heavily bound McpCaptureCommon (30 claims) and posthog-events.ts with ZERO customer-visible behavior or wire-key changes. Must make 0 edits.',
      prData: toPrData(
        'posthog-js',
        'planted-h4-behavior-preserving-refactor',
        POST_E24_COMMITS['posthog-js'],
        'Extract internal distinctId/timestamp helper functions and tidy McpCaptureCommon type layout. No runtime or wire-format changes.',
        [h4Events, h4Types]
      ),
      assertions: [
        {
          id: 'h4_zero_edits',
          page: null,
          description: 'Makes zero .mdx edits on a behavior-preserving internal refactor',
          check: (_diff, editedPages) => editedPages.length === 0,
        },
      ],
    },
    {
      id: 'H5a',
      suite: 'planted_hard',
      date: '2026-11-26',
      kind: 'human_docs_pr',
      repo: 'posthog-com',
      prNumber: 23901,
      commit: 'planted-h5a-human-identifying-users-restructure',
      title: 'docs(mcp-analytics): add quick summary and reorganize identifying-users.mdx (#23901)',
      category: 'planted_human_mdx_restructure_soft_drift',
      truthNeedsDocs: false,
      truthChangeKind: null,
      truthPages: [],
      truthNeedsIaUpdate: true,
      notes: 'Planted H5a: Human docs editor restructures identifying-users.mdx (+28 lines, renames heading) without touching IA. Tests 3-tier soft-drift claim re-anchoring right before H5b.',
      virtualDocsOverrides: {
        'contents/docs/mcp-analytics/identifying-users.mdx': restructuredIdentifyingUsers,
      },
    },
    {
      id: 'H5b',
      suite: 'planted_hard',
      date: '2026-11-26',
      kind: 'code_pr',
      repo: 'posthog-python',
      prNumber: 1402,
      commit: 'planted-h5b-python-scoped-anon-fallback',
      title: 'fix(mcp): scope fallback actor id per server instead of global anonymous (#1402)',
      category: 'planted_post_restructure_subtle_code_change',
      truthNeedsDocs: true,
      truthChangeKind: 'update',
      truthPages: [
        'contents/docs/mcp-analytics/identifying-users.mdx',
      ],
      truthNeedsIaUpdate: true,
      notes: 'Planted H5b: Immediately after H5a shifted identifying-users.mdx lines +28 and renamed the section heading, Python SDK changes fallback distinct_id from literal "anonymous" to "mcp-anon-<server_name>".',
      prData: toPrData(
        'posthog-python',
        'planted-h5b-python-scoped-anon-fallback',
        POST_E24_COMMITS['posthog-python'],
        'Avoid collapsing unidentified sessionless events across different Python MCP servers into one global "anonymous" actor by formatting fallback distinct_id as `mcp-anon-<server_name>` (defaulting to `mcp-anon-default`).',
        [h5Events, h5Instr]
      ),
      assertions: [
        {
          id: 'h5b_identifying_users_updated',
          page: 'contents/docs/mcp-analytics/identifying-users.mdx',
          description: 'Updates moved fallback section in identifying-users.mdx with mcp-anon-<server_name>',
          check: diff => /\+.*mcp-anon-/i.test(diff),
        },
      ],
    },
  ];

  return {
    events,
    virtualDocsOverridesByCommit: {
      'planted-h5a-human-identifying-users-restructure': {
        'contents/docs/mcp-analytics/identifying-users.mdx': restructuredIdentifyingUsers,
      },
    },
  };
}
