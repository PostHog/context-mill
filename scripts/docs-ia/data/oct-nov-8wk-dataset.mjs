// 8-Week Chronological PR Replay Dataset for `mcp-analytics` (`T0 = 2026-10-03` -> `T_end = 2026-11-23` + 4 Planted Hard PRs)
// Every real event (R01..R49) is an authentic merged Git commit from PostHog/posthog, PostHog/posthog-js,
// PostHog/posthog-python, PostHog/posthog-rs, or PostHog/posthog.com, verified against actual follow-up
// posthog.com docs PRs (#20733, #21007, #21501, #21548, #21600, #21653, #21684, #21762, #21880, #22354, #22535, #22541, #22751)
// and John W's needs_docs.jsonl evals.
//
// Each positive PR also carries objective on-disk `docChecks` evaluated against each arm's live `.mdx` tree
// after EVERY PR so we can measure BOTH cumulative PR handling accuracy AND live on-disk doc accuracy / open drift over time.

import { join } from 'node:path';

const REPOS_ROOT = process.env.DOCS_IA_REPOS_ROOT || '.repos';

export const OCT3_T0_COMMITS = {
  posthog: 'd05fae69e1747a95da038a068cd38683e52ec964',
  'posthog-js': 'abe2924c96a1ddb1d32362dc97bdd9ce121672ce',
  'posthog-python': '48bb7da8cfb989f1b2d71225def979b43002cf08',
  'posthog-rs': 'd319ce82a860d65fb3d21f487d64d108cd23654f',
  'posthog-com': '64cfcfdb91e659242d25ac2d440dc1e685946338',
};

export const REPO_SEARCH_DIRS = {
  posthog: [
    ...(process.env.DOCS_IA_POSTHOG_DIRS ? process.env.DOCS_IA_POSTHOG_DIRS.split(':').filter(Boolean) : []),
    join(REPOS_ROOT, 'posthog'),
  ],
  'posthog-js': [
    process.env.DOCS_IA_POSTHOG_JS_DIR || join(REPOS_ROOT, 'posthog-js'),
  ],
  'posthog-python': [
    process.env.DOCS_IA_POSTHOG_PYTHON_DIR || join(REPOS_ROOT, 'posthog-python'),
  ],
  'posthog-rs': [
    process.env.DOCS_IA_POSTHOG_RS_DIR || join(REPOS_ROOT, 'posthog-rs'),
  ],
  'posthog-com': [
    process.env.DOCS_IA_POSTHOG_COM_DIR || join(REPOS_ROOT, 'posthog.com'),
  ],
};

// Diverse 10-event pilot slice spanning every maintenance path:
// noise skip, unreleased flag gate, new feature option, breaking change, brand-new unmapped SDK (R19),
// follow-up PR hitting newly-mapped Rust SDK (R35), watched release manifest (R31),
// human .mdx delete/edit (R18), flag removal + UI retirement (R45), and silent feature deletion (H3).
export const PILOT_EVENT_IDS = [
  'R07', // Oct 9  - posthog#114168: trial leaderboard layout behind NEW flag (defer!)
  'R08', // Oct 9  - posthog-js#5224: add $mcp_interface property (new wire prop -> map & update events.mdx)
  'R09', // Oct 12 - posthog#115406: bold card titles (CSS noise -> skip!)
  'R12', // Oct 19 - posthog-js#5306: stop sending standalone $identify (breaking multi-page contradiction!)
  'R18', // Oct 26 - posthog-com#21548: human deletes surfaces/desktop.mdx + edits web-app.mdx (reconcile!)
  'R19', // Oct 26 - posthog-rs#308: BRAND-NEW Rust SDK (81 files, 0 prior IA facts -> map new SDK + create rust.mdx!)
  'R31', // Nov 6  - posthog-js#5584: release @posthog/mcp 1.0.0 (watched manifest only, 0 code files!)
  'R35', // Nov 6  - posthog-rs#333: align Rust SDK annotations & optional llm_model (hits R19's newly-mapped IA!)
  'R45', // Nov 13 - posthog#135656: unflag leaderboard & retire old dashboard (closes R07 flag arc!)
  'H3',  // Planted - silent deletion of reportMissing / get_more_tools in @posthog/mcp (retire + 4 pages!)
];

function pageHas(docsMap, pagePath, regex) {
  const txt = docsMap.get(pagePath);
  if (typeof txt !== 'string') return false;
  return regex.test(txt);
}

function anyPageHas(docsMap, pagePaths, regex) {
  return pagePaths.some(p => pageHas(docsMap, p, regex));
}

function pageExists(docsMap, pagePath) {
  return typeof docsMap.get(pagePath) === 'string' && docsMap.get(pagePath).trim().length > 80;
}

export const REAL_8WK_EVENTS = [
  // ── Week 1–2 (Oct 5–14, 2026) ──
  {
    id: 'R01',
    date: '2026-10-05',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5165,
    commit: '339454849c6efa3a309f1d4905e1016abb5e4863',
    title: 'feat(mcp): resolve argument ownership on fresh low-level instances (#5165)',
    category: 'new_sdk_option',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: ['contents/docs/mcp-analytics/installation/typescript.mdx'],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r01-ts-resolve',
        pagePath: 'contents/docs/mcp-analytics/installation/typescript.mdx',
        description: 'Documents resolveOriginalTool option on TypeScript install page',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/typescript.mdx', /resolveOriginalTool/),
      },
    ],
  },
  {
    id: 'R02',
    date: '2026-10-05',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 989,
    commit: '8ef0573',
    title: 'feat(mcp): record safe tool input names (#989)',
    category: 'new_event_property_and_option',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/events.mdx',
      'contents/docs/mcp-analytics/installation/python.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r02-events-input-keys',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'Documents $mcp_input_keys on events.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/events.mdx', /\$mcp_input_keys/),
      },
      {
        id: 'chk-r02-py-input-key-opt',
        pagePath: 'contents/docs/mcp-analytics/installation/python.mdx',
        description: 'Documents should_record_input_key or input key recording on python.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/python.mdx', /should_record_input_key|\$mcp_input_keys|resolve_input_aliases/),
      },
    ],
  },
  {
    id: 'R03',
    date: '2026-10-06',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 112430,
    commit: 'e4d08f8f9b0444aaecfb56bd15577204dde04216',
    title: 'feat(mcp-analytics): recognize kimchi as a harness (#112430)',
    category: 'harness_list_detail_negative',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
  {
    id: 'R04',
    date: '2026-10-06',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5191,
    commit: '6cd54960354ec66c2dd7932fadac9c9cf308d938',
    title: 'feat(browser): capture WebMCP intent and model (#5191)',
    category: 'new_surface_feature',
    truthNeedsDocs: true,
    truthChangeKind: 'create',
    truthPages: [
      'contents/docs/mcp-analytics/installation/webmcp.mdx',
      'contents/docs/mcp-analytics/installation/index.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r04-webmcp-docs',
        pagePath: 'contents/docs/mcp-analytics/installation/webmcp.mdx',
        description: 'Documents WebMCP capture (either installation/webmcp.mdx or installation/index.mdx + intent/events)',
        test: m =>
          pageHas(m, 'contents/docs/mcp-analytics/installation/webmcp.mdx', /webmcp|capture_webmcp/i) ||
          anyPageHas(m, [
            'contents/docs/mcp-analytics/installation/index.mdx',
            'contents/docs/mcp-analytics/installation/typescript.mdx',
          ], /webmcp|capture_webmcp/i),
      },
    ],
  },
  {
    id: 'R05',
    date: '2026-10-07',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5162,
    commit: '31329989b12896eed051af91f7269c0db28f775c',
    title: 'perf(mcp): sanitize each tool response once (#5162)',
    category: 'perf_noise',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R06',
    date: '2026-10-08',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1009,
    commit: '127009d',
    title: 'feat(mcp): resolve fresh low-level tool ownership (#1009)',
    category: 'new_sdk_option',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: ['contents/docs/mcp-analytics/installation/python.mdx'],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r06-py-resolve',
        pagePath: 'contents/docs/mcp-analytics/installation/python.mdx',
        description: 'Documents resolve_original_tool on Python install page',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/python.mdx', /resolve_original_tool/),
      },
    ],
  },
  {
    id: 'R07',
    date: '2026-10-09',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 114168,
    commit: '53b5142a2f21737aaeb2c6839eb0706e08eb64f3',
    title: 'feat(mcp-analytics): trial leaderboard layout on home tab (#114168)',
    category: 'flagged_unreleased_feature',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R08',
    date: '2026-10-09',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5224,
    commit: 'ec9080aad4dc6cccfe2d77f0a00420f442a90e48',
    title: 'feat(mcp): add interface property to server events (#5224)',
    category: 'new_event_property',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: ['contents/docs/mcp-analytics/events.mdx'],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r08-mcp-interface',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'Documents $mcp_interface property on events.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/events.mdx', /\$mcp_interface/),
      },
    ],
  },
  {
    id: 'R09',
    date: '2026-10-12',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 115406,
    commit: 'd83465b7cf3',
    title: 'fix(mcp-analytics): bold the model, harness and protocol card titles (#115406)',
    category: 'ui_polish_noise',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R10',
    date: '2026-10-12',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1032,
    commit: 'a3bd254',
    title: 'feat(mcp): set $mcp_interface on mcp analytics events (#1032)',
    category: 'new_event_property',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: ['contents/docs/mcp-analytics/events.mdx'],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r10-py-mcp-interface',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'events.mdx reflects $mcp_interface across server SDKs (including Python)',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/events.mdx', /\$mcp_interface/),
      },
    ],
  },
  {
    id: 'R11',
    date: '2026-10-14',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 110382,
    commit: '2d0d7fce8e0',
    title: 'feat(mcp-analytics): agent eval runner for any MCP server (#110382)',
    category: 'internal_eval_cli_excluded',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },

  // ── Week 3–4 (Oct 19–30, 2026) ──
  {
    id: 'R12',
    date: '2026-10-19',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5306,
    commit: '19b9b54e10c9944f6288d2c29487e99b596e6c83',
    title: 'feat(mcp): stop sending standalone $identify events (#5306)',
    category: 'breaking_behavior_contradiction',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/identifying-users.mdx',
      'contents/docs/mcp-analytics/events.mdx',
      'contents/docs/mcp-analytics/installation/index.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r12-identifying-no-standalone',
        pagePath: 'contents/docs/mcp-analytics/identifying-users.mdx',
        description: 'identifying-users.mdx reflects that TypeScript no longer emits standalone $identify events',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/identifying-users.mdx') || '';
          return (
            /(?:no longer|doesn't|does not|don't|do not|stops?|no standalone|instead of.*\$identify|only.*ruby|ruby.*\$identify)/i.test(txt) &&
            !/Emits a `\$identify` event the first time it sees the identity, or when the identity changes for that session\. The Go SDK doesn't emit `\$identify`\./.test(txt)
          );
        },
      },
      {
        id: 'chk-r12-events-set-on-events',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'events.mdx updates $set / $identify claim so it no longer says $set is only on $identify',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/events.mdx') || '';
          return !/^Set on `\$identify` events when `identify\(\)` returns a user\.$/m.test(txt);
        },
      },
    ],
  },
  {
    id: 'R13',
    date: '2026-10-19',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1067,
    commit: 'facd617',
    title: 'feat(mcp): stop sending standalone $identify events (#1067)',
    category: 'breaking_behavior_contradiction',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/identifying-users.mdx',
      'contents/docs/mcp-analytics/events.mdx',
      'contents/docs/mcp-analytics/installation/index.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r13-py-no-standalone-identify',
        pagePath: 'contents/docs/mcp-analytics/identifying-users.mdx',
        description: 'identifying-users.mdx reflects Python also stops sending standalone $identify',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/identifying-users.mdx') || '';
          return (
            /(?:no longer|doesn't|does not|don't|do not|no standalone|only.*ruby|ruby.*\$identify|every event)/i.test(txt) &&
            !/Except in Go, the SDK caches identities per session to avoid duplicate `\$identify` events\./.test(txt)
          );
        },
      },
    ],
  },
  {
    id: 'R14',
    date: '2026-10-22',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 121984,
    commit: '9eb904c6c36',
    title: 'fix(mcp-analytics): count users by distinct_id to avoid person join oom (#121984)',
    category: 'internal_bugfix_perf',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R15',
    date: '2026-10-23',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 122171,
    commit: '06a4603fbee549f714c263fb87b3da4354c6f4f3',
    title: 'fix(mcp-analytics): allow 128-char session ids for intent generation (#122171)',
    category: 'limit_update',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/events.mdx',
      'contents/docs/mcp-analytics/installation/typescript.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r15-128-char-limit',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'Documents 128-character session ID limit on events.mdx (or typescript.mdx)',
        test: m => anyPageHas(m, [
          'contents/docs/mcp-analytics/events.mdx',
          'contents/docs/mcp-analytics/installation/typescript.mdx',
          'contents/docs/mcp-analytics/intent.mdx',
        ], /128/),
      },
    ],
  },
  {
    id: 'R16',
    date: '2026-10-23',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1103,
    commit: '8cd8eb5',
    title: 'fix(mcp): send one $mcp_initialize per initialize request (#1103)',
    category: 'bugfix_restores_behavior',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R17',
    date: '2026-10-24',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 122813,
    commit: '9620ffd6a03',
    title: 'perf(mcp-analytics): compute tool latency quantiles in one pass (#122813)',
    category: 'perf_noise',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R18',
    date: '2026-10-26',
    kind: 'human_docs_pr',
    repo: 'posthog-com',
    prNumber: 21548,
    commit: '990fa817bdad8c5855785da4387c1332aefa0625',
    title: 'docs: remove PostHog Desktop docs and redirect to self-driving (#21548)',
    category: 'human_mdx_page_deletion',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
  {
    id: 'R19',
    date: '2026-10-26',
    kind: 'code_pr',
    repo: 'posthog-rs',
    prNumber: 308,
    commit: '8408705',
    title: 'MCP analytics for Rust MCP servers (#308)',
    category: 'brand_new_unmapped_sdk',
    truthNeedsDocs: true,
    truthChangeKind: 'create',
    truthPages: [
      'contents/docs/mcp-analytics/installation/rust.mdx',
      'contents/docs/mcp-analytics/installation/index.mdx',
      'contents/docs/mcp-analytics/events.mdx',
      'contents/docs/mcp-analytics/identifying-users.mdx',
      'contents/docs/mcp-analytics/start-here.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r19-rust-page-created',
        pagePath: 'contents/docs/mcp-analytics/installation/rust.mdx',
        description: 'Creates installation/rust.mdx documenting posthog-rs MCP analytics',
        test: m => pageExists(m, 'contents/docs/mcp-analytics/installation/rust.mdx') &&
          pageHas(m, 'contents/docs/mcp-analytics/installation/rust.mdx', /posthog[-_]rs|McpAnalytics/i),
      },
      {
        id: 'chk-r19-install-index-rust',
        pagePath: 'contents/docs/mcp-analytics/installation/index.mdx',
        description: 'Adds Rust to the installation/index.mdx SDK comparison table',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/index.mdx', /\bRust\b/),
      },
    ],
  },
  {
    id: 'R20',
    date: '2026-10-28',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5401,
    commit: '8faad6aa2',
    title: 'feat(mcp): add a sendInitializeEvent option (#5401)',
    category: 'new_sdk_option',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/typescript.mdx',
      'contents/docs/mcp-analytics/events.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r20-ts-send-init',
        pagePath: 'contents/docs/mcp-analytics/installation/typescript.mdx',
        description: 'Documents sendInitializeEvent on typescript.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/typescript.mdx', /sendInitializeEvent/),
      },
      {
        id: 'chk-r20-events-send-init',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'Documents sendInitializeEvent on events.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/events.mdx', /sendInitializeEvent/),
      },
    ],
  },
  {
    id: 'R21',
    date: '2026-10-28',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5404,
    commit: '68336dfb0',
    title: 'feat(mcp): add a sendToolsListEvent option (#5404)',
    category: 'new_sdk_option',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/typescript.mdx',
      'contents/docs/mcp-analytics/events.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r21-ts-send-tools',
        pagePath: 'contents/docs/mcp-analytics/installation/typescript.mdx',
        description: 'Documents sendToolsListEvent on typescript.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/typescript.mdx', /sendToolsListEvent/),
      },
      {
        id: 'chk-r21-events-send-tools',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'Documents sendToolsListEvent on events.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/events.mdx', /sendToolsListEvent/),
      },
    ],
  },
  {
    id: 'R22',
    date: '2026-10-28',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1115,
    commit: 'd8a1b97',
    title: 'feat(mcp): add a send_initialize_event option (#1115)',
    category: 'new_sdk_option',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/python.mdx',
      'contents/docs/mcp-analytics/events.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r22-py-send-init',
        pagePath: 'contents/docs/mcp-analytics/installation/python.mdx',
        description: 'Documents send_initialize_event on python.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/python.mdx', /send_initialize_event/),
      },
      {
        id: 'chk-r22-events-send-init-py',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'Documents send_initialize_event on events.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/events.mdx', /send_initialize_event/),
      },
    ],
  },
  {
    id: 'R23',
    date: '2026-10-28',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1116,
    commit: '351da59',
    title: 'feat(mcp): add a send_tools_list_event option (#1116)',
    category: 'new_sdk_option',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/python.mdx',
      'contents/docs/mcp-analytics/events.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r23-py-send-tools',
        pagePath: 'contents/docs/mcp-analytics/installation/python.mdx',
        description: 'Documents send_tools_list_event on python.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/python.mdx', /send_tools_list_event/),
      },
      {
        id: 'chk-r23-events-send-tools-py',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'Documents send_tools_list_event on events.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/events.mdx', /send_tools_list_event/),
      },
    ],
  },
  {
    id: 'R24',
    date: '2026-10-30',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 126310,
    commit: '92bd26fe5aa',
    title: 'refactor(frontend): move members logic to models and drop preflight shim (#126310)',
    category: 'internal_refactor_noise',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },

  // ── Week 5–8 (Nov 2–23, 2026 — all E01..E24 + posthog-js#5584) ──
  {
    id: 'R25',
    date: '2026-11-02',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 126239,
    commit: '061c515e6577494f8844250f441a65835d0ef624',
    title: 'fix(mcp-analytics): scroll share lists instead of stretching the chart beside them (#126239)',
    category: 'ui_polish_noise',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R26',
    date: '2026-11-04',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 125299,
    commit: 'd9819e4d5731869657af26529d54391015afe913',
    title: 'feat(mcp-analytics): add internal users toggle to missing capabilities (#125299)',
    category: 'ui_filter_and_generated_mcp_schema',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
  {
    id: 'R27',
    date: '2026-11-04',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 128189,
    commit: '579d3bf48b5a84366605bde282fae834aeef0e01',
    title: 'feat(mcp-analytics): route llm calls through the ai gateway (#128189)',
    category: 'internal_backend_plumbing',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R28',
    date: '2026-11-05',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 128669,
    commit: '80f480ddac72a1b7ad1c35e25ffd4f497f0ad137',
    title: 'feat(mcp-analytics): add setup mode state and logic behind a flag (#128669)',
    category: 'flagged_unreleased_feature',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R29',
    date: '2026-11-05',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5573,
    commit: '88dbf08e319a60ec1f5c4eeaca25a55a3fa54fe6',
    title: 'fix(mcp): reword injected descriptions so directory review stops flagging them (#5573)',
    category: 'cross_sdk_directory_review',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
  {
    id: 'R30',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5583,
    commit: '2a08e91a69b0c1d9e24ccf177505e63f94f139d3',
    title: 'feat(mcp): align @posthog/mcp with the MCP analytics spec before 1.0 (#5583)',
    category: 'john_eval_multi_page_contradiction',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/index.mdx',
      'contents/docs/mcp-analytics/events.mdx',
      'contents/docs/mcp-analytics/identifying-users.mdx',
      'contents/docs/mcp-analytics/installation/typescript.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r30-ts-unknown-tool-matrix',
        pagePath: 'contents/docs/mcp-analytics/installation/index.mdx',
        description: 'installation/index.mdx marks TypeScript as Yes for $mcp_unknown_tool',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/installation/index.mdx') || '';
          const row = txt.split('\n').find(l => /\$mcp_unknown_tool/i.test(l)) || '';
          return /\|\s*Yes\s*\|/i.test(row.split('|').slice(2, 3).join('|') ? `|${row.split('|')[2]}|` : '');
        },
      },
      {
        id: 'chk-r30-ts-llm-model-optional',
        pagePath: 'contents/docs/mcp-analytics/installation/typescript.mdx',
        description: 'typescript.mdx reflects optional llm_model or $mcp_unknown_tool alignment',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/typescript.mdx', /\$mcp_unknown_tool|optional.*llm_model|llm_model.*optional|annotations/i),
      },
    ],
  },
  {
    id: 'R31',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5584,
    commit: '650e968dbc6d7f62af3eaa17299d0e0d1096799a',
    title: 'feat(mcp): release @posthog/mcp 1.0.0 (#5584)',
    category: 'watched_manifest_status_promotion',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/typescript.mdx',
      'contents/docs/mcp-analytics/installation/index.mdx',
      'contents/docs/mcp-analytics/start-here.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r31-ts-ga-not-beta',
        pagePath: 'contents/docs/mcp-analytics/installation/typescript.mdx',
        description: 'typescript.mdx no longer says @posthog/mcp is pre-1.0 beta',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/installation/typescript.mdx') || '';
          return !/is in beta \(pre-1\.0\)/i.test(txt);
        },
      },
      {
        id: 'chk-r31-index-ts-stable',
        pagePath: 'contents/docs/mcp-analytics/installation/index.mdx',
        description: 'installation/index.mdx promotes TypeScript support from Beta to Stable/GA',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/installation/index.mdx') || '';
          const row = txt.split('\n').find(l => /^\|\s*Support\s*\|/i.test(l)) || '';
          const tsCell = (row.split('|')[2] || '').trim();
          return /stable|ga|1\.0/i.test(tsCell);
        },
      },
    ],
  },
  {
    id: 'R32',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1199,
    commit: '0aa5df18d1c60769de1307677b1e0e649eb023e8',
    title: 'feat(mcp): align posthog.mcp with the sdk-specs MCP spec (#1199)',
    category: 'john_eval_multi_page_contradiction',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/index.mdx',
      'contents/docs/mcp-analytics/events.mdx',
      'contents/docs/mcp-analytics/identifying-users.mdx',
      'contents/docs/mcp-analytics/installation/python.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r32-py-unknown-tool-matrix',
        pagePath: 'contents/docs/mcp-analytics/installation/index.mdx',
        description: 'installation/index.mdx marks Python as Yes for $mcp_unknown_tool',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/installation/index.mdx') || '';
          const row = txt.split('\n').find(l => /\$mcp_unknown_tool/i.test(l)) || '';
          const pyCell = (row.split('|')[3] || '').trim();
          return /^yes/i.test(pyCell);
        },
      },
    ],
  },
  {
    id: 'R33',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1200,
    commit: '5f2ee56bb0f2b3815e863045c6506a35ae4053b8',
    title: 'feat(mcp): declare posthog.mcp stable (#1200)',
    category: 'john_eval_status_promotion',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/python.mdx',
      'contents/docs/mcp-analytics/start-here.mdx',
      'contents/docs/mcp-analytics/installation/index.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r33-index-py-stable',
        pagePath: 'contents/docs/mcp-analytics/installation/index.mdx',
        description: 'installation/index.mdx promotes Python support from Beta to Stable/GA',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/installation/index.mdx') || '';
          const row = txt.split('\n').find(l => /^\|\s*Support\s*\|/i.test(l)) || '';
          const pyCell = (row.split('|')[3] || '').trim();
          return /stable|ga/i.test(pyCell);
        },
      },
    ],
  },
  {
    id: 'R34',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog-python',
    prNumber: 1204,
    commit: '778f386eaacd1ea9379852c3b032a9f19a6271ea',
    title: 'feat(mcp): tell directory reviews what the virtual tools record (#1204)',
    category: 'new_guide_page_needed',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/index.mdx',
      'contents/docs/mcp-analytics/intent.mdx',
      'contents/docs/mcp-analytics/start-here.mdx',
      'contents/docs/mcp-analytics/installation/python.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r34-directory-review-annotations',
        pagePath: 'contents/docs/mcp-analytics/installation/python.mdx',
        description: 'Documents virtual tool annotations / directory review descriptions',
        test: m => anyPageHas(m, [
          'contents/docs/mcp-analytics/installation/python.mdx',
          'contents/docs/mcp-analytics/intent.mdx',
          'contents/docs/mcp-analytics/installation/index.mdx',
          'contents/docs/mcp-analytics/directory-review.mdx',
        ], /directory review|readOnlyHint|destructiveHint|openWorldHint/i),
      },
    ],
  },
  {
    id: 'R35',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog-rs',
    prNumber: 333,
    commit: '98d2bf1b6186e9461efa70977f1a28f5dca34899',
    title: 'feat(mcp): align virtual tool annotations, context text and llm_model with the spec (#333)',
    category: 'sdk_spec_alignment_on_newly_mapped_sdk',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: ['contents/docs/mcp-analytics/installation/rust.mdx'],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r35-rust-aligned',
        pagePath: 'contents/docs/mcp-analytics/installation/rust.mdx',
        description: 'installation/rust.mdx reflects optional llm_model or virtual tool annotations',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/installation/rust.mdx', /optional.*llm_model|llm_model.*optional|readOnlyHint|read_only_hint|destructive_hint|annotations/i),
      },
    ],
  },
  {
    id: 'R36',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 124838,
    commit: '62b7efbaed1447f219e26aaf051f50011c375fad',
    title: 'feat(mcp-analytics): let teams name their own harnesses (#124838)',
    category: 'new_settings_and_api_surface',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/surfaces/web-app.mdx',
      'contents/docs/mcp-analytics/surfaces/api.mdx',
      'contents/docs/mcp-analytics/events.mdx',
      'contents/docs/mcp-analytics/queries.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r36-custom-harness-api',
        pagePath: 'contents/docs/mcp-analytics/surfaces/api.mdx',
        description: 'Documents custom harness REST API on surfaces/api.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/surfaces/api.mdx', /custom_harness|custom harness/i),
      },
      {
        id: 'chk-r36-custom-harness-web',
        pagePath: 'contents/docs/mcp-analytics/surfaces/web-app.mdx',
        description: 'Documents custom harness settings on surfaces/web-app.mdx',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/surfaces/web-app.mdx', /custom harness/i),
      },
    ],
  },
  {
    id: 'R37',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 125824,
    commit: '10e82b09303c9e0ffb9e6f202df999e706ff5634',
    title: 'feat(hogql): apply custom mcp harness names to $virt_mcp_harness (#125824)',
    category: 'cross_team_hogql_virtual_prop',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/queries.mdx',
      'contents/docs/mcp-analytics/events.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r37-virt-mcp-harness',
        pagePath: 'contents/docs/mcp-analytics/queries.mdx',
        description: 'Documents $virt_mcp_harness on queries.mdx or events.mdx',
        test: m => anyPageHas(m, [
          'contents/docs/mcp-analytics/queries.mdx',
          'contents/docs/mcp-analytics/events.mdx',
        ], /\$virt_mcp_harness/),
      },
    ],
  },
  {
    id: 'R38',
    date: '2026-11-06',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 131278,
    commit: 'cbda16c2e05529b761fd75b0a340de5585e4c8b1',
    title: 'feat(mcp-analytics): show exec commands, argument names and failure details on session calls (#131278)',
    category: 'john_eval_ui_detail_negative',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
  {
    id: 'R39',
    date: '2026-11-09',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 131058,
    commit: '21ddffb95e30851aaa2a0f6bddbb53228ba765fc',
    title: 'feat(mcp-analytics): group tool failures by cause and drill into each one (#131058)',
    category: 'john_eval_ui_detail_negative',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
  {
    id: 'R40',
    date: '2026-11-09',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 132113,
    commit: '8823e0d1f96bae97bdb7843bfe3e395e42c53647',
    title: "perf(mcp-analytics): bound session tool calls by the session's end (#132113)",
    category: 'john_eval_perf_generated_negative',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R41',
    date: '2026-11-09',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 131998,
    commit: 'b9bb3dc703cdd1fc35066f13b7889ad4276bc291',
    title: 'fix(mcp-analytics): reload sessions when the team test-account default changes (#131998)',
    category: 'john_eval_bugfix_restores_behavior',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R42',
    date: '2026-11-10',
    kind: 'code_pr',
    repo: 'posthog-js',
    prNumber: 5597,
    commit: '4d0681fc2843c1299bf3955884dbcb4944518f74',
    title: 'feat(mcp): per-request sessionId and clientInfo options (#5597)',
    category: 'john_eval_sdk_options_and_precedence',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/installation/typescript.mdx',
      'contents/docs/mcp-analytics/events.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r42-ts-clientinfo',
        pagePath: 'contents/docs/mcp-analytics/installation/typescript.mdx',
        description: 'Documents per-request clientInfo / sessionId option on instrument() (or host clientInfo precedence)',
        test: m => {
          const ts = m.get('contents/docs/mcp-analytics/installation/typescript.mdx') || '';
          const ev = m.get('contents/docs/mcp-analytics/events.mdx') || '';
          return /\|\s*`clientInfo`\s*\||`clientInfo`[\s\S]{0,60}(?:option|override|precedence|outrank|per-request|host|callback)|clientInfo:\s*\{/i.test(`${ts}\n${ev}`);
        },
      },
    ],
  },
  {
    id: 'R43',
    date: '2026-11-12',
    kind: 'human_docs_pr',
    repo: 'posthog-com',
    prNumber: 21762,
    commit: '876c6debffddce7138486d8d9ef0d573cee126be',
    title: 'docs(mcp-analytics): tighten copy after the GA accuracy pass (#21762)',
    category: 'human_mdx_soft_drift',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
  {
    id: 'R44',
    date: '2026-11-12',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 134803,
    commit: '25727a81a0f1a2735a7233c504528c09071d6003',
    title: "perf(mcp-analytics): bound settled sessions' tool calls by their end (#134803)",
    category: 'perf_noise',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: false,
    docChecks: [],
  },
  {
    id: 'R45',
    date: '2026-11-13',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 135656,
    commit: '522a1fdc8dd0fa871785b9e163a2bce94bab6c3a',
    title: 'feat(mcp-analytics): ship the leaderboard as the only home layout (#135656)',
    category: 'flag_removal_and_ui_retirement',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: ['contents/docs/mcp-analytics/surfaces/web-app.mdx'],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r45-leaderboard-home',
        pagePath: 'contents/docs/mcp-analytics/surfaces/web-app.mdx',
        description: 'surfaces/web-app.mdx reflects the new home layout widgets (leaderboard / share of calls / protocol share / most called tools)',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/surfaces/web-app.mdx', /leaderboard|share of calls|protocol version share|most called tools|first look/i),
      },
    ],
  },
  {
    id: 'R46',
    date: '2026-11-13',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 126523,
    commit: '9050d5822cf13e3b68ffc774a8c5641a1d0966c4',
    title: 'feat(mcp-analytics): list send_feedback missing-capability reports (#126523)',
    category: 'routing_shadow_bug_and_contradiction',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: [
      'contents/docs/mcp-analytics/missing-capability.mdx',
      'contents/docs/mcp-analytics/surfaces/web-app.mdx',
      'contents/docs/mcp-analytics/surfaces/api.mdx',
    ],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r46-send-feedback-missing-cap',
        pagePath: 'contents/docs/mcp-analytics/missing-capability.mdx',
        description: 'missing-capability.mdx mentions $mcp_feedback or send_feedback',
        test: m => pageHas(m, 'contents/docs/mcp-analytics/missing-capability.mdx', /\$mcp_feedback|send_feedback/),
      },
      {
        id: 'chk-r46-webapp-or-api-feedback',
        pagePath: 'contents/docs/mcp-analytics/surfaces/web-app.mdx',
        description: 'surfaces/web-app.mdx or surfaces/api.mdx mentions $mcp_feedback / send_feedback',
        test: m => anyPageHas(m, [
          'contents/docs/mcp-analytics/surfaces/web-app.mdx',
          'contents/docs/mcp-analytics/surfaces/api.mdx',
        ], /\$mcp_feedback|send_feedback/),
      },
    ],
  },
  {
    id: 'R47',
    date: '2026-11-16',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 135724,
    commit: '056918ce71ff8702377a5e7eda300cbb43de9899',
    title: 'feat(mcp-analytics): split recurring automated intents out of clustering (#135724)',
    category: 'backend_clustering_detail_negative',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
  {
    id: 'R48',
    date: '2026-11-20',
    kind: 'code_pr',
    repo: 'posthog',
    prNumber: 127287,
    commit: '91a8bcf9d9cb9b2bdf972368547028f8e5d76442',
    title: 'feat(mcp): name more harnesses and drop structuredContent by default (#127287)',
    category: 'mcp_server_and_harness_resolver',
    truthNeedsDocs: true,
    truthChangeKind: 'update',
    truthPages: ['contents/docs/mcp-analytics/events.mdx'],
    truthNeedsIaUpdate: true,
    docChecks: [
      {
        id: 'chk-r48-events-harness-ua',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        supersededBy: 'H2',
        description: 'events.mdx notes generic library clientInfo names (rmcp/mcp-client) or User-Agent harness promotion',
        test: m => anyPageHas(m, [
          'contents/docs/mcp-analytics/events.mdx',
          'contents/docs/mcp-analytics/surfaces/mcp.mdx',
        ], /rmcp|mcp-client|structuredContent/i),
      },
    ],
  },
  {
    id: 'R49',
    date: '2026-11-23',
    kind: 'human_docs_pr',
    repo: 'posthog-com',
    prNumber: 22541,
    commit: 'a0eeda34da6c748df0fc1a909f902fe6b6fd8977',
    title: 'docs(mcp-analytics): trim the event reference, installation, concept and shared pages (#22541)',
    category: 'human_mdx_large_trim_soft_drift',
    truthNeedsDocs: false,
    truthChangeKind: null,
    truthPages: [],
    truthNeedsIaUpdate: true,
    docChecks: [],
  },
];
