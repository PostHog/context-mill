#!/usr/bin/env node
// Stateful 8-Week Chronological 2-Arm Claude Code SDK Benchmark on `mcp-analytics`
//   Window: Oct 3, 2026 -> Nov 23, 2026 (46 real code PRs + 3 real human .mdx PRs + 4 planted hard PRs = 53 events)
//   Pilot mode (`--pilot`): 10 diverse chronological events to test & harden the maintenance code first.
//
// Two arms run in parallel as independent STATEFUL chronological streams (edits carry forward PR -> PR!):
//   - Arm 1 (`baseline_agent`):    Plain "maintain the docs" prompt + Read/Grep/Glob/Edit/Write. No IA.
//   - Arm 2 (`ia_assisted_agent`): Decision-tree prompt + Read/Grep/Glob/Edit/Write + stateful read/write
//                                  `docs-ia` MCP tools (`ia_pin_delta`, `ia_inspect_code`, `ia_update_fact`,
//                                  `ia_retire_fact`, `ia_map_code`, `ia_blast_radius`, `ia_lookup_facts`,
//                                  `ia_lookup_page_claims`, `ia_audit_trail`, `ia_update_doc_bindings`)
//                                  + deterministic 0-LLM pre-gate & human `.mdx` soft-drift reconciler.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

import {
  query as claudeQuery,
} from '/Users/vincent/work-code/workbench/posthog.com-docmap-bootstrap/docmap/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs';
import {
  assertSubscriptionInit,
  inspectSettingsConflicts,
  sanitizeSubscriptionEnv,
  verifyLocalSubscriptionAuth,
} from '/Users/vincent/work-code/workbench/docs-ia-clean-run-2/docmap/tools/bootstrap/claude-driver.mjs';

import {
  OCT3_T0_COMMITS,
  PILOT_EVENT_IDS,
  REAL_8WK_EVENTS,
  REPO_SEARCH_DIRS,
} from '../data/oct-nov-8wk-dataset.mjs';
import { buildPlantedHardEvents } from '../data/planted-hard-events.mjs';
import {
  createStatefulDocsIaMcpServer,
  StatefulIaStore,
} from '../runtime/stateful-ia-engine.mjs';
import { createTreeSitterAstParser } from '../tools/tree-sitter-parser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const T0_OCT3_DIR = join(ROOT, 'out', 't0-oct3');
const DIFF_CACHE_DIR = join(ROOT, 'cache', 'pr-diffs-8wk');
const PRODUCT_YML = resolve(ROOT, '..', 'context-mill-docs-ia', 'facts', 'products', 'mcp-analytics.yml');

const ARGS = new Set(process.argv.slice(2));
const IS_PILOT = ARGS.has('--pilot');
const IDS_ARG = (() => {
  const idx = process.argv.indexOf('--ids');
  return idx >= 0 ? new Set(process.argv[idx + 1].split(',').map(s => s.trim()).filter(Boolean)) : null;
})();
const ARM_ARG = (() => {
  const idx = process.argv.indexOf('--arm');
  return idx >= 0 ? process.argv[idx + 1] : 'both';
})();
const TAG_ARG = (() => {
  const idx = process.argv.indexOf('--tag');
  return idx >= 0 ? process.argv[idx + 1] : (IS_PILOT ? 'pilot' : 'full');
})();

const RESULTS_DIR = join(ROOT, 'results', `stateful-8wk-${TAG_ARG}`);
const TRANSCRIPTS_DIR = join(RESULTS_DIR, 'transcripts');
mkdirSync(DIFF_CACHE_DIR, { recursive: true });
mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

const MODEL = process.env.CLAUDE_BENCH_MODEL || 'claude-sonnet-5-5';
const EFFORT = process.env.CLAUDE_BENCH_EFFORT || 'medium';
const MAX_TURNS_BASELINE = Number(process.env.CLAUDE_BENCH_MAX_TURNS_BASE || 20);
const MAX_TURNS_IA = Number(process.env.CLAUDE_BENCH_MAX_TURNS_IA || 28);

// ── Verbatim Prompt Templates (attached verbatim in Addendum 5!) ──

export const BASELINE_SYSTEM_RULES = `A product PR just merged. Keep the public docs under \`contents/docs/mcp-analytics/\` accurate.

- Read the PR diff (and inspect changed code files under \`pr-code/\` if the diff is truncated) and inspect any docs pages that might be affected.
- Edit a page (or create a new \`.mdx\` page if a new SDK or surface requires one) only if the PR contradicts existing docs, removes a documented behavior, or adds a customer-facing option, event, API, or workflow.
- Skip internal refactors, style tweaks, unreleased feature flags, and bug fixes that restore already-documented behavior.
- Check every affected page, not just the first one you find. Make minimal, factual edits directly on disk.`;

export const IA_DECISION_TREE_RULES = `A product PR just merged. Keep the Docs IA and the public docs under \`contents/docs/mcp-analytics/\` accurate together.

Follow this decision tree on every PR (batch multiple IA updates, retirements, code mappings, or page bindings into ONE tool call using \`items\` / \`entries\` / \`pages\` arrays):

1. Check what changed in the IA (\`ia_pin_delta\`).
   - Start by calling \`ia_pin_delta\`. Review changed symbols (with existing IA facts), deleted symbols, new/unmapped symbols, watched release manifests, brand-new surfaces, and unflagged features.
   - If nothing customer-facing changed, stop and leave docs untouched.
2. Invalidate or update existing IA facts (\`ia_update_fact\`, \`ia_retire_fact\`).
   - Batch all altered code behaviors into one \`ia_update_fact(items=[...])\` call.
   - Batch all removed symbols/behaviors into one \`ia_retire_fact(items=[...])\` call (include \`replacedBy\` if superseded).
3. Map new or unmapped code to the IA (\`ia_inspect_code\`, \`ia_map_code\`).
   - If the PR adds a new customer-facing option, event, API, release status, UI workflow, or a brand-new SDK/surface (or touches unmapped code), inspect the key source files and batch-map those customer-facing behaviors into the IA with \`ia_map_code(entries=[...])\` BEFORE editing docs.
   - For a large brand-new SDK PR, map the core public entrypoints, options, events, and limits across the key public files in 1 to 2 batched \`ia_map_code\` calls rather than every internal helper.
4. Trace impact (\`ia_blast_radius\`), then decide whether docs need edits or stay untouched:
   - ALWAYS call \`ia_blast_radius\` AFTER Steps 2 and 3 (before any \`Edit\` or \`Write\`). Review \`candidatePages\`, \`surfaceLandingPages\` (e.g. API/web-app/SDK landing pages for touched surfaces), and \`newSurfaceCrossCuttingPages\`.
   - **Keep \`.mdx\` docs untouched** when updating the IA is enough: if \`brandNewSurfaces\` is empty and the PR only adds a minor UI filter/toggle/drawer detail, adds one item to an open-ended list, refines internal backend clustering/sanitization, or fixes a bug to match already-documented behavior, and the existing summary-level claims in \`ia_blast_radius\` remain true as written, do NOT edit \`.mdx\` files.
   - **Edit ALL affected \`.mdx\` pages together** when \`brandNewSurfaces\` is non-empty (create the new surface's install/guide page and update cross-surface index/tables), OR when the PR contradicts an existing documented claim, removes a documented feature, promotes SDK maturity (e.g. Beta to Stable/1.0), or adds a customer-facing SDK, option, event, REST API endpoint, settings workflow, or virtual property. Check EVERY relevant page from \`ia_blast_radius\` (including cross-surface tables, \`events.mdx\`, \`installation/index.mdx\`, and every touched \`surfaceLandingPages\` entry — e.g., update BOTH API and web-app docs when a PR adds both an API endpoint and a UI settings workflow), apply minimal factual edits, and batch-update bindings with \`ia_update_doc_bindings(pages=[...])\`.`;

// ── Git helpers supporting multi-checkout lookup for `posthog` (Oct in posthog-setup-401, Nov in posthog-onboarding-fixes) ──

const commitRepoCache = new Map();

function findRepoDirForCommit(repo, commit) {
  const key = `${repo}:${commit}`;
  if (commitRepoCache.has(key)) return commitRepoCache.get(key);
  for (const dir of REPO_SEARCH_DIRS[repo] || []) {
    try {
      execFileSync('git', ['-C', dir, 'cat-file', '-e', `${commit}^{commit}`], { stdio: 'ignore' });
      commitRepoCache.set(key, dir);
      return dir;
    } catch {}
  }
  throw new Error(`Commit ${commit} not found for repo ${repo}`);
}

function readFileAtCommit(repo, commit, relPath) {
  try {
    const dir = findRepoDirForCommit(repo, commit);
    return execFileSync('git', ['-C', dir, 'show', `${commit}:${relPath}`], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function loadOrBuildPrData(ev) {
  if (ev.prData) return ev.prData;
  const cachePath = join(DIFF_CACHE_DIR, `${ev.repo}-${ev.commit.slice(0, 12)}.json`);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf8'));
  }
  const dir = findRepoDirForCommit(ev.repo, ev.commit);
  const body = execFileSync('git', ['-C', dir, 'show', '-s', '--format=%B', ev.commit], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  const nameStatusRaw = execFileSync(
    'git',
    ['-C', dir, 'diff-tree', '--no-commit-id', '--name-status', '-r', '-M', `${ev.commit}^`, ev.commit],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  const files = [];
  const diffByPath = {};
  for (const line of nameStatusRaw.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const st = parts[0];
    let status = st[0];
    let oldPath = parts[1];
    let path = parts[1];
    if (status === 'R' || status === 'C') {
      oldPath = parts[1];
      path = parts[2];
    }
    files.push({ status, path, oldPath });
    try {
      const targetArgs = status === 'R' ? [oldPath, path] : [path];
      const d = execFileSync(
        'git',
        ['-C', dir, 'diff', '-M', `${ev.commit}^`, ev.commit, '--', ...targetArgs],
        { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
      );
      diffByPath[path] = d;
    } catch {
      diffByPath[path] = '';
    }
  }
  const data = { repo: ev.repo, commit: ev.commit, title: ev.title, body, files, diffByPath };
  writeFileSync(cachePath, JSON.stringify(data, null, 2));
  return data;
}

function loadOct3DocsMap(docsPrefix) {
  const commit = OCT3_T0_COMMITS['posthog-com'];
  const dir = findRepoDirForCommit('posthog-com', commit);
  const raw = execFileSync('git', ['-C', dir, 'ls-tree', '-r', '--name-only', commit, docsPrefix], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const map = new Map();
  for (const line of raw.split('\n')) {
    const p = line.trim();
    if (!p || !/\.(md|mdx)$/i.test(p)) continue;
    const txt = readFileAtCommit('posthog-com', commit, p);
    if (txt !== null) map.set(p, txt);
  }
  return map;
}

/**
 * Apply an authentic human `.mdx` PR (`commit^..commit`) onto an arm's evolving `docsMap`
 * WITHOUT overwriting prior agent edits:
 *   - Deleted files (`D`) are removed from `docsMap`.
 *   - Added files (`A`) are inserted if not already present.
 *   - Modified files (`M`) apply the unified patch via `patch --batch --forward --fuzz=3` so
 *     non-conflicting human edits & line shifts land cleanly while preserving earlier agent edits.
 */
function applyHumanDocsPrToMap(docsMap, ev, docsPrefix) {
  const dir = findRepoDirForCommit('posthog-com', ev.commit);
  const nameStatusRaw = execFileSync(
    'git',
    ['-C', dir, 'diff-tree', '--no-commit-id', '--name-status', '-r', '-M', `${ev.commit}^`, ev.commit, '--', docsPrefix],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  const stats = { deleted: 0, added: 0, patched: 0, partialConflicts: 0, touchedPages: [] };
  const tmp = mkdtempSync(join(tmpdir(), 'human-mdx-patch-'));
  try {
    for (const line of nameStatusRaw.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      const status = parts[0][0];
      const filePath = status === 'R' ? parts[2] : parts[1];
      const oldPath = parts[1];
      if (!/\.(md|mdx)$/i.test(filePath)) continue;

      if (status === 'D') {
        docsMap.delete(oldPath);
        stats.deleted++;
        stats.touchedPages.push(oldPath);
        continue;
      }
      if (status === 'A') {
        if (!docsMap.has(filePath)) {
          const text = readFileAtCommit('posthog-com', ev.commit, filePath);
          if (text !== null) {
            docsMap.set(filePath, text);
            stats.added++;
            stats.touchedPages.push(filePath);
          }
        }
        continue;
      }
      if (status === 'R') {
        const cur = docsMap.get(oldPath);
        docsMap.delete(oldPath);
        if (cur !== undefined) docsMap.set(filePath, cur);
      }

      const curText = docsMap.get(filePath);
      if (curText === undefined) {
        const text = readFileAtCommit('posthog-com', ev.commit, filePath);
        if (text !== null) docsMap.set(filePath, text);
        stats.added++;
        stats.touchedPages.push(filePath);
        continue;
      }

      const fileDiff = execFileSync(
        'git',
        ['-C', dir, 'diff', `${ev.commit}^`, ev.commit, '--', filePath],
        { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
      );
      if (!fileDiff.trim()) continue;
      const targetFile = join(tmp, 'target.mdx');
      const patchFile = join(tmp, 'human.patch');
      const rejFile = join(tmp, 'target.rej');
      writeFileSync(targetFile, curText);
      writeFileSync(patchFile, fileDiff);
      const res = spawnSync(
        'patch',
        ['--batch', '--forward', '--fuzz=3', '--no-backup-if-mismatch', '-r', rejFile, targetFile, patchFile],
        { encoding: 'utf8' }
      );
      const nextText = readFileSync(targetFile, 'utf8');
      docsMap.set(filePath, nextText);
      if (res.status === 0) stats.patched++;
      else stats.partialConflicts++;
      stats.touchedPages.push(filePath);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return stats;
}

function computeUnifiedDiff(relPath, beforeText, afterText) {
  const dir = mkdtempSync(join(tmpdir(), 'mdx-diff-'));
  try {
    const aFile = join(dir, 'a');
    const bFile = join(dir, 'b');
    writeFileSync(aFile, beforeText ?? '');
    writeFileSync(bFile, afterText ?? '');
    const aLabel = beforeText === null ? '/dev/null' : `a/${relPath}`;
    const bLabel = afterText === null ? '/dev/null' : `b/${relPath}`;
    try {
      return execFileSync('diff', ['-u', '--label', aLabel, '--label', bLabel, aFile, bFile], {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch (err) {
      if (err.status === 1 && typeof err.stdout === 'string') return err.stdout;
      throw err;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function walkFiles(dir, rootDir = dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkFiles(full, rootDir));
    else out.push(relative(rootDir, full).replace(/\\/g, '/'));
  }
  return out.sort();
}

function canonExisting(targetPath) {
  let cur = resolve(targetPath);
  const tail = [];
  while (!existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) break;
    tail.unshift(basename(cur));
    cur = parent;
  }
  const real = existsSync(cur) ? realpathSync(cur) : cur;
  return tail.length ? join(real, ...tail) : real;
}

function createBenchmarkToolFence({ workspaceRoot, docsWriteRoot, allowDocsIaMcp, iaGuardState = null }) {
  const readRoot = canonExisting(workspaceRoot);
  const writeRoot = canonExisting(docsWriteRoot);
  const within = (rootDir, target) => target === rootDir || target.startsWith(`${rootDir}${sep}`);
  const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);
  const WRITE_TOOLS = new Set(['Edit', 'Write']);

  return async (toolName, input) => {
    if (allowDocsIaMcp && toolName.startsWith('mcp__docs-ia__')) {
      if (iaGuardState) {
        if (toolName === 'mcp__docs-ia__ia_blast_radius') iaGuardState.calledBlastRadius = true;
        if (toolName === 'mcp__docs-ia__ia_pin_delta') iaGuardState.calledPinDelta = true;
      }
      return { behavior: 'allow', updatedInput: input };
    }
    if (READ_TOOLS.has(toolName)) {
      const rawPath = toolName === 'Read' ? input?.file_path : input?.path;
      if (toolName === 'Read' && (!rawPath || typeof rawPath !== 'string')) {
        return { behavior: 'deny', message: 'Read requires file_path inside workspace.' };
      }
      const target = rawPath ? canonExisting(resolve(readRoot, String(rawPath))) : readRoot;
      if (!within(readRoot, target)) {
        return { behavior: 'deny', message: `${toolName} outside workspace is blocked: ${target}` };
      }
      const patterns = toolName === 'Glob' ? [input?.pattern] : toolName === 'Grep' ? [input?.glob] : [];
      for (const pat of patterns.filter(p => typeof p === 'string' && p.trim())) {
        if (/(^|[\\/])\.\.([\\/]|$)/.test(pat) || (isAbsolute(pat) && !within(readRoot, canonExisting(pat.split(/[*?[{]/)[0] || '/')))) {
          return { behavior: 'deny', message: `${toolName} pattern outside workspace is blocked: ${pat}` };
        }
      }
      return { behavior: 'allow', updatedInput: input };
    }
    if (WRITE_TOOLS.has(toolName)) {
      if (allowDocsIaMcp && iaGuardState && !iaGuardState.calledBlastRadius) {
        return {
          behavior: 'deny',
          message: 'Decision-tree Step 4 guardrail: call mcp__docs-ia__ia_blast_radius first so you inspect every affected docs page (candidatePages + surfaceLandingPages) before calling Edit or Write.',
        };
      }
      const rawPath = input?.file_path;
      if (!rawPath || typeof rawPath !== 'string') {
        return { behavior: 'deny', message: `${toolName} requires file_path inside contents/docs/mcp-analytics/.` };
      }
      const target = canonExisting(resolve(readRoot, String(rawPath)));
      if (!within(writeRoot, target) || !/\.(md|mdx)$/i.test(target)) {
        return {
          behavior: 'deny',
          message: `${toolName} is allowed ONLY on .mdx/.md files inside contents/docs/mcp-analytics/ (got ${target}).`,
        };
      }
      return { behavior: 'allow', updatedInput: input };
    }
    return { behavior: 'deny', message: `${toolName} is not allowed in this docs-maintenance sandbox.` };
  };
}

function buildPrPrompt({ arm, ev, prData, fullDiffText, docsFiles, stagedCodeFiles, workspaceRoot }) {
  const maxInlineDiffChars = 24_000;
  const diffTruncated = fullDiffText.length > maxInlineDiffChars;
  const inlineDiff = diffTruncated
    ? `${fullDiffText.slice(0, maxInlineDiffChars)}\n\n... [Diff truncated in prompt; full diff is at ${join(workspaceRoot, 'pr-diff.patch')} and changed source files are under ${join(workspaceRoot, 'pr-code')}/]`
    : fullDiffText;

  const filesSummary = (prData.files || []).slice(0, 60).map(f => `- [${f.status}] ${f.path}`).join('\n') +
    ((prData.files || []).length > 60 ? `\n- ... (${prData.files.length - 60} more files; inspect pr-code/ or pr-diff.patch)` : '');

  const docsPageList = docsFiles.map(f => `- ${f}`).join('\n');
  const codeHint = stagedCodeFiles.length
    ? `- Changed source files at the PR commit are also staged read-only under \`${join(workspaceRoot, 'pr-code')}/\` (${stagedCodeFiles.length} files).`
    : '';

  const instructionsBlock = arm === 'ia_assisted_agent' ? IA_DECISION_TREE_RULES : BASELINE_SYSTEM_RULES;

  return `${instructionsBlock}

## Workspace
- Editable docs live under \`${join(workspaceRoot, 'contents/docs/mcp-analytics')}\`.
- Full PR diff is saved read-only at \`${join(workspaceRoot, 'pr-diff.patch')}\`.
${codeHint}

## Current docs pages on disk (${docsFiles.length})
${docsPageList}

## Merged PR under review
- **Repository:** \`${ev.repo}\`
- **PR:** #${ev.prNumber} (\`${ev.commit}\`)
- **Date:** ${ev.date}
- **Title:** ${ev.title}
- **PR description:**
${String(prData.body || '(empty)').slice(0, 1800)}

### Changed files (${(prData.files || []).length})
${filesSummary}

### Unified diff
\`\`\`diff
${inlineDiff}
\`\`\`

Follow your instructions above, edit/create any required \`.mdx\` files directly on disk (or leave all files untouched if no docs update is needed), and finish with a brief summary.`;
}

async function runSingleStatefulPr({ arm, ev, prData, docsMap, iaStore, parseAst, cleanEnv, settingsCheck }) {
  const startedAt = Date.now();
  const fullDiffText = (prData.files || []).map(f => prData.diffByPath?.[f.path] || '').filter(Boolean).join('\n');

  // For Arm 2: compute deterministic pin delta & principled pre-gate BEFORE spawning LLM
  let delta = null;
  if (arm === 'ia_assisted_agent') {
    delta = await iaStore.analyzePrDelta({ event: ev, prData, readFileAtCommit, parseAst });
    if (delta.preGateSkipReason) {
      return {
        arm,
        eventId: ev.id,
        date: ev.date,
        repo: ev.repo,
        prNumber: ev.prNumber,
        title: ev.title,
        preGateSkipped: true,
        preGateSkipReason: delta.preGateSkipReason,
        editedPages: [],
        createdPages: [],
        diffsByPage: {},
        toolCalls: [],
        mcpToolCalls: [],
        iaMutations: { updatedFacts: [], retiredFacts: [], mappedFacts: [], updatedBindings: [], mintedClaims: [], retiredClaims: [], toolCallCounts: {} },
        durationSec: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
        numTurns: 0,
        finalText: `Skipped deterministically (${delta.preGateSkipReason}).`,
      };
    }
  }

  // Stage isolated workspace with THIS ARM'S current stateful docsMap + read-only pr-diff.patch + pr-code/
  const workspaceRoot = mkdtempSync(join(tmpdir(), `docs-8wk-${arm}-${ev.id}-`));
  const docsWriteRoot = join(workspaceRoot, 'contents', 'docs', 'mcp-analytics');
  mkdirSync(docsWriteRoot, { recursive: true });

  for (const [relPath, text] of docsMap.entries()) {
    const abs = join(workspaceRoot, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  writeFileSync(join(workspaceRoot, 'pr-diff.patch'), fullDiffText);

  // Stage changed non-test source files read-only under `pr-code/` identically for BOTH arms!
  const stagedCodeFiles = [];
  const candidateFiles = (prData.files || [])
    .filter(f => f.status !== 'D' && !/(__tests__|\/tests?\/|\.test\.|\.spec\.|snapshots\.yml|lock\.yaml|package-lock)/i.test(f.path))
    .slice(0, 80);
  for (const f of candidateFiles) {
    const text = f.text !== undefined ? f.text : readFileAtCommit(ev.repo, ev.commit, f.path);
    if (typeof text === 'string' && text.length <= 200_000) {
      const dst = join(workspaceRoot, 'pr-code', f.path);
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, text);
      stagedCodeFiles.push(f.path);
    }
  }

  const docsFiles = [...docsMap.keys()].sort();
  const prompt = buildPrPrompt({ arm, ev, prData, fullDiffText, docsFiles, stagedCodeFiles, workspaceRoot });

  const allowDocsIaMcp = arm === 'ia_assisted_agent';
  const mcpBundle = allowDocsIaMcp
    ? createStatefulDocsIaMcpServer({ store: iaStore, delta, event: ev, workspaceRoot, parseAst })
    : null;

  const toolCalls = [];
  let finalText = '';
  let usage = null;
  let numTurns = 0;
  let initInfo = null;
  let runError = null;

  const iaGuardState = allowDocsIaMcp ? { calledPinDelta: false, calledBlastRadius: false } : null;
  const abortController = new AbortController();
  try {
    const q = claudeQuery({
      prompt,
      options: {
        cwd: workspaceRoot,
        env: cleanEnv,
        abortController,
        model: MODEL,
        effort: EFFORT,
        maxTurns: allowDocsIaMcp ? MAX_TURNS_IA : MAX_TURNS_BASELINE,
        tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write'],
        disallowedTools: [
          'Bash', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch',
          'Agent', 'Task', 'Skill', 'TodoWrite', 'ToolSearch',
        ],
        canUseTool: createBenchmarkToolFence({ workspaceRoot, docsWriteRoot, allowDocsIaMcp, iaGuardState }),
        ...(allowDocsIaMcp ? { mcpServers: { 'docs-ia': mcpBundle.server } } : {}),
        strictMcpConfig: true,
        settingSources: [],
        settings: { autoMemoryEnabled: false },
        permissionMode: 'default',
        allowDangerouslySkipPermissions: false,
        persistSession: false,
      },
    });

    for await (const msg of q) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        const acct = typeof q.accountInfo === 'function' ? await q.accountInfo() : undefined;
        assertSubscriptionInit(msg, settingsCheck, acct);
        initInfo = {
          model: msg.model ?? MODEL,
          apiKeySource: msg.apiKeySource ?? null,
          mcpServers: (msg.mcp_servers ?? []).map(s => ({ name: s.name, status: s.status })),
        };
      } else if (msg.type === 'assistant') {
        const blocks = msg.message?.content || [];
        for (const b of blocks) {
          if (b.type === 'tool_use') {
            toolCalls.push({ name: b.name, input: b.input });
          } else if (b.type === 'text' && b.text) {
            finalText = b.text;
          }
        }
      } else if (msg.type === 'result') {
        numTurns = msg.num_turns || 0;
        usage = msg.usage || null;
        if (typeof msg.result === 'string' && msg.result.trim()) finalText = msg.result;
        if (msg.is_error) runError = msg.errors?.join('; ') || msg.subtype || 'sdk_error';
      }
    }

    // Diff on-disk docs directory against `docsMap` and persist edits into this arm's live `docsMap`!
    const afterFiles = walkFiles(docsWriteRoot, workspaceRoot).filter(p => /\.(md|mdx)$/i.test(p));
    const allPaths = [...new Set([...docsMap.keys(), ...afterFiles])].sort();
    const editedPages = [];
    const createdPages = [];
    const diffsByPage = {};

    for (const relPath of allPaths) {
      const before = docsMap.has(relPath) ? docsMap.get(relPath) : null;
      const abs = join(workspaceRoot, relPath);
      const after = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
      if (before !== after) {
        editedPages.push(relPath);
        if (before === null && after !== null) createdPages.push(relPath);
        diffsByPage[relPath] = computeUnifiedDiff(relPath, before, after);
        if (after === null) docsMap.delete(relPath);
        else docsMap.set(relPath, after);
      }
    }

    // For Arm 2: deterministically reconcile any edited/created `.mdx` pages into live IA so line numbers never drift!
    if (allowDocsIaMcp && editedPages.length > 0) {
      iaStore.reconcileDocsMap(docsMap, { docsCommit: `agent:${ev.id}`, today: ev.date, onlyPages: editedPages });
    }

    return {
      arm,
      eventId: ev.id,
      date: ev.date,
      repo: ev.repo,
      prNumber: ev.prNumber,
      title: ev.title,
      preGateSkipped: false,
      preGateSkipReason: null,
      editedPages,
      createdPages,
      diffsByPage,
      toolCalls: toolCalls.map(t => ({
        name: t.name,
        summary: t.name === 'Edit' || t.name === 'Write' || t.name === 'Read'
          ? t.input?.file_path
          : (t.input?.pagePath || t.input?.path || t.input?.defId || t.input?.factCode || t.input?.query || ''),
      })),
      mcpToolCalls: toolCalls.filter(t => t.name.startsWith('mcp__docs-ia__')).map(t => t.name.replace('mcp__docs-ia__', '')),
      iaMutations: mcpBundle ? mcpBundle.prMutations : null,
      durationSec: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
      numTurns,
      usage,
      initInfo,
      runError,
      finalText: String(finalText || '').slice(0, 1500),
    };
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

function scoreEventAndUpdateRunning({ ev, run, docsMap, state }) {
  const predNeedsDocs = run.editedPages.length > 0;
  const truthNeedsDocs = Boolean(ev.truthNeedsDocs);
  if (truthNeedsDocs && predNeedsDocs) state.tp++;
  else if (!truthNeedsDocs && !predNeedsDocs) state.tn++;
  else if (!truthNeedsDocs && predNeedsDocs) state.fp++;
  else state.fn++;

  // Page-level micro precision/recall across ALL code PRs (penalizes spurious edits on negative PRs too!)
  const truthSet = new Set(ev.truthPages || []);
  const predSet = new Set(run.editedPages || []);
  let pageTp = 0;
  for (const p of predSet) if (truthSet.has(p)) pageTp++;
  const pageFp = predSet.size - pageTp;
  const pageFn = truthSet.size - pageTp;
  state.pageTp += pageTp;
  state.pageFp += pageFp;
  state.pageFn += pageFn;

  // Register this PR's objective live-doc checks into the active cumulative ground-truth checklist
  state.seenEventIds ??= new Set();
  state.seenEventIds.add(ev.id);
  for (const chk of ev.docChecks || []) {
    state.activeChecks.push({ eventId: ev.id, ...chk });
  }

  // Evaluate ALL active (non-superseded) checks against the arm's ACTUAL live `.mdx` files on disk right now!
  const activeUnsuperseded = state.activeChecks.filter(
    chk => !chk.supersededBy || !state.seenEventIds.has(chk.supersededBy)
  );
  let checksPassed = 0;
  const failingChecks = [];
  for (const chk of activeUnsuperseded) {
    let ok = false;
    try { ok = Boolean(chk.test(docsMap)); } catch { ok = false; }
    if (ok) checksPassed++;
    else failingChecks.push({ id: chk.id, eventId: chk.eventId, pagePath: chk.pagePath, description: chk.description });
  }

  // Per-PR check pass (for checks introduced by THIS PR)
  const thisPrChecks = (ev.docChecks || []).map(chk => {
    let ok = false;
    try { ok = Boolean(chk.test(docsMap)); } catch { ok = false; }
    return { id: chk.id, ok, description: chk.description };
  });

  const codePrCount = state.tp + state.tn + state.fp + state.fn;
  const prPrec = state.tp + state.fp ? state.tp / (state.tp + state.fp) : 1;
  const prRec = state.tp + state.fn ? state.tp / (state.tp + state.fn) : 1;
  const cumPrF1 = prPrec + prRec ? (2 * prPrec * prRec) / (prPrec + prRec) : 0;
  const cumPrAccuracy = codePrCount ? (state.tp + state.tn) / codePrCount : 1;

  const pgPrec = state.pageTp + state.pageFp ? state.pageTp / (state.pageTp + state.pageFp) : 1;
  const pgRec = state.pageTp + state.pageFn ? state.pageTp / (state.pageTp + state.pageFn) : 1;
  const cumPageF1 = pgPrec + pgRec ? (2 * pgPrec * pgRec) / (pgPrec + pgRec) : 0;

  const liveDocsAccuracy = activeUnsuperseded.length
    ? checksPassed / activeUnsuperseded.length
    : 1;
  const openDocDrift = failingChecks.length + state.fp;

  return {
    t: codePrCount,
    eventId: ev.id,
    date: ev.date,
    repo: ev.repo,
    prNumber: ev.prNumber,
    title: ev.title,
    category: ev.category,
    truthNeedsDocs,
    predNeedsDocs,
    prDecisionCorrect: predNeedsDocs === truthNeedsDocs,
    truthPages: ev.truthPages || [],
    editedPages: run.editedPages,
    pageTp,
    pageFp,
    pageFn,
    thisPrChecks,
    preGateSkipped: run.preGateSkipped,
    preGateSkipReason: run.preGateSkipReason,
    mcpCallsCount: (run.mcpToolCalls || []).length,
    iaMutationsSummary: run.iaMutations
      ? {
          updatedFacts: run.iaMutations.updatedFacts.length,
          retiredFacts: run.iaMutations.retiredFacts.length,
          mappedFacts: run.iaMutations.mappedFacts.length,
          updatedBindings: run.iaMutations.updatedBindings.length,
          mintedClaims: run.iaMutations.mintedClaims.length,
        }
      : null,
    durationSec: run.durationSec,
    numTurns: run.numTurns,
    running: {
      codePrCount,
      tp: state.tp,
      tn: state.tn,
      fp: state.fp,
      fn: state.fn,
      cumPrAccuracy: Number(cumPrAccuracy.toFixed(4)),
      cumPrF1: Number(cumPrF1.toFixed(4)),
      cumPagePrecision: Number(pgPrec.toFixed(4)),
      cumPageRecall: Number(pgRec.toFixed(4)),
      cumPageF1: Number(cumPageF1.toFixed(4)),
      activeChecksTotal: activeUnsuperseded.length,
      activeChecksPassed: checksPassed,
      liveDocsAccuracy: Number(liveDocsAccuracy.toFixed(4)),
      openDocDrift,
      failingChecksCount: failingChecks.length,
    },
    failingChecksSnapshot: failingChecks,
  };
}

function buildPlantedEventsWithChecks() {
  const repoDirs = {
    posthog: REPO_SEARCH_DIRS.posthog[0],
    'posthog-js': REPO_SEARCH_DIRS['posthog-js'][0],
    'posthog-python': REPO_SEARCH_DIRS['posthog-python'][0],
    'posthog-rs': REPO_SEARCH_DIRS['posthog-rs'][0],
    'posthog-com': REPO_SEARCH_DIRS['posthog-com'][0],
  };
  const { events: plantedEvents } = buildPlantedHardEvents(repoDirs);
  // Keep H1, H2, H3, H4 (real human .mdx restructures are already authentic R18, R43, R49!)
  const selected = plantedEvents.filter(e => ['H1', 'H2', 'H3', 'H4'].includes(e.id));
  const checkMap = {
    H1: [
      {
        id: 'chk-h1-py-capture-model-false',
        pagePath: 'contents/docs/mcp-analytics/installation/python.mdx',
        description: 'python.mdx reflects capture_model defaulting to False (off by default)',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/installation/python.mdx') || '';
          return /capture_model[\s\S]{0,220}(?:false|off by default|disabled by default)/i.test(txt);
        },
      },
    ],
    H2: [
      {
        id: 'chk-h2-harness-precedence',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'events.mdx reflects clientInfo.name / $mcp_client_name taking top precedence',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/events.mdx') || '';
          return /\$mcp_client_name[\s\S]{0,180}(?:first|top|highest|precedence|before.*vendor|outranks)/i.test(txt) ||
            /1\.\s*\*{0,2}`?\$mcp_client_name/i.test(txt);
        },
      },
      {
        id: 'chk-h2-proto-version',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        description: 'Documents updated protocol version 2026-11-01',
        test: m => [...m.values()].some(t => /2026-11-01/.test(t)),
      },
    ],
    H3: [
      {
        id: 'chk-h3-missing-cap-removed',
        pagePath: 'contents/docs/mcp-analytics/missing-capability.mdx',
        description: 'missing-capability.mdx notes reportMissing / get_more_tools removed in TypeScript SDK',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/missing-capability.mdx') || '';
          return /(?:removed|deprecated|no longer|replaced by.*collectFeedback|send_feedback)/i.test(txt);
        },
      },
      {
        id: 'chk-h3-ts-removed',
        pagePath: 'contents/docs/mcp-analytics/installation/typescript.mdx',
        description: 'typescript.mdx removes or marks reportMissing / missingCapabilityToolName as removed',
        test: m => {
          const txt = m.get('contents/docs/mcp-analytics/installation/typescript.mdx') || '';
          return !/\|\s*`reportMissing`\s*\|\s*`false`/.test(txt) || /removed|deprecated|replaced by/i.test(txt);
        },
      },
    ],
    H4: [],
  };
  return selected.map(e => ({
    ...e,
    suite: 'planted_hard',
    docChecks: checkMap[e.id] || [],
  }));
}

async function runArmStream({ arm, events, productConfig, t0Data, parseAst, cleanEnv, settingsCheck }) {
  const docsMap = loadOct3DocsMap(productConfig.docs_prefix);
  const iaStore = arm === 'ia_assisted_agent'
    ? new StatefulIaStore({
        anchors: t0Data.anchors,
        facts: t0Data.facts,
        claims: t0Data.claims,
        outline: t0Data.outline,
        register: t0Data.register,
        productConfig,
      })
    : null;

  const scoreState = { tp: 0, tn: 0, fp: 0, fn: 0, pageTp: 0, pageFp: 0, pageFn: 0, activeChecks: [] };
  const trajectory = [];
  const humanEvents = [];

  for (const ev of events) {
    if (ev.kind === 'human_docs_pr') {
      const patchStats = applyHumanDocsPrToMap(docsMap, ev, productConfig.docs_prefix);
      let reconcileStats = null;
      if (iaStore) {
        const rec = iaStore.reconcileDocsMap(docsMap, { docsCommit: ev.commit, today: ev.date });
        reconcileStats = rec.stats;
      }
      humanEvents.push({ eventId: ev.id, date: ev.date, title: ev.title, patchStats, reconcileStats });
      console.log(`  [${arm}] ${ev.id} (human .mdx PR #${ev.prNumber}): patched=${patchStats.patched} deleted=${patchStats.deleted} conflicts=${patchStats.partialConflicts}${reconcileStats ? ` | IA exact=${reconcileStats.exactSamePage} moved=${reconcileStats.movedCrossPage} soft=${reconcileStats.humanEdited} retired=${reconcileStats.retiredDeleted}` : ''}`);
      continue;
    }

    const prData = loadOrBuildPrData(ev);
    const run = await runSingleStatefulPr({
      arm,
      ev,
      prData,
      docsMap,
      iaStore,
      parseAst,
      cleanEnv,
      settingsCheck,
    });

    const point = scoreEventAndUpdateRunning({ ev, run, docsMap, state: scoreState });
    if (iaStore) {
      point.iaSnapshotCounts = {
        liveFacts: iaStore.factsByCode.size,
        liveClaims: iaStore.claimsByCode.size,
        retiredLeaves: iaStore.register.retiredLeaves.length,
        anchors: iaStore.anchorsById.size,
      };
    }
    trajectory.push(point);

    // Save per-PR transcript + real diffs immediately
    writeFileSync(
      join(TRANSCRIPTS_DIR, `${arm}__${ev.id}.json`),
      JSON.stringify({ run, point }, null, 2)
    );

    const statusIcon = point.prDecisionCorrect ? 'OK' : (ev.truthNeedsDocs ? 'MISS' : 'FP');
    const chkStr = point.thisPrChecks.length
      ? ` checks=${point.thisPrChecks.filter(c => c.ok).length}/${point.thisPrChecks.length}`
      : '';
    const iaStr = run.iaMutations
      ? ` ia(upd=${run.iaMutations.updatedFacts.length},ret=${run.iaMutations.retiredFacts.length},map=${run.iaMutations.mappedFacts.length},bnd=${run.iaMutations.updatedBindings.length + run.iaMutations.mintedClaims.length})`
      : '';
    console.log(
      `  [${arm}] #${String(point.t).padStart(2, '0')} ${ev.id} (${ev.date}) [${statusIcon}] edits=${run.editedPages.length}/${ev.truthPages.length}${chkStr}${iaStr} | liveAcc=${(point.running.liveDocsAccuracy * 100).toFixed(1)}% prF1=${point.running.cumPrF1.toFixed(3)} pgF1=${point.running.cumPageF1.toFixed(3)} drift=${point.running.openDocDrift} (${run.durationSec}s)`
    );
  }

  // Persist final docs snapshot and (for Arm 2) final IA state
  const finalDocsObj = Object.fromEntries([...docsMap.entries()].sort());
  writeFileSync(join(RESULTS_DIR, `${arm}-final-docs.json`), JSON.stringify(finalDocsObj, null, 2));
  if (iaStore) {
    writeFileSync(
      join(RESULTS_DIR, `${arm}-final-ia-summary.json`),
      JSON.stringify(
        {
          liveFactsCount: iaStore.factsByCode.size,
          liveClaimsCount: iaStore.claimsByCode.size,
          retiredLeavesCount: iaStore.register.retiredLeaves.length,
          anchorsCount: iaStore.anchorsById.size,
          factsBySurface: iaStore.surfaces.reduce((acc, s) => {
            acc[s] = iaStore.allFacts().filter(f => f.surface === s).length;
            return acc;
          }, {}),
          retiredSample: iaStore.register.retiredLeaves.slice(-20),
        },
        null,
        2
      )
    );
  }

  return { arm, trajectory, humanEvents, finalRunning: trajectory.at(-1)?.running || null };
}

async function main() {
  console.log(`=== Stateful 8-Week Chronological Claude SDK Benchmark (${IS_PILOT ? 'PILOT' : 'FULL'} | tag=${TAG_ARG}) ===`);
  const cleanEnv = sanitizeSubscriptionEnv(process.env);
  const settingsCheck = inspectSettingsConflicts(cleanEnv);
  const authInfo = verifyLocalSubscriptionAuth(cleanEnv);
  console.log(`Auth verified: ${authInfo.authMethod} (${authInfo.subscriptionType || 'team'}) | Model: ${MODEL} | Effort: ${EFFORT}`);

  const productConfig = yaml.load(readFileSync(PRODUCT_YML, 'utf8'));
  const t0Data = {
    anchors: JSON.parse(readFileSync(join(T0_OCT3_DIR, 't0-anchors.json'), 'utf8')),
    facts: JSON.parse(readFileSync(join(T0_OCT3_DIR, 't0-facts.json'), 'utf8')),
    claims: JSON.parse(readFileSync(join(T0_OCT3_DIR, 't0-claims.json'), 'utf8')),
    outline: JSON.parse(readFileSync(join(T0_OCT3_DIR, 't0-outline.json'), 'utf8')),
    register: JSON.parse(readFileSync(join(T0_OCT3_DIR, 'mcpa.codes.json'), 'utf8')),
  };

  let parseAst = null;
  const tsRes = await createTreeSitterAstParser({
    moduleSearchPaths: ['/Users/vincent/work-code/workbench/posthog.com-docmap-bootstrap/docmap/node_modules'],
  });
  if (tsRes.available) parseAst = tsRes.parseAst;
  console.log(`AST parser: ${parseAst ? 'tree-sitter WASM' : 'fallback'} | Oct 3 T0: ${t0Data.facts.length} facts, ${t0Data.claims.length} claims`);

  const plantedEvents = buildPlantedEventsWithChecks();
  const fullEvents = [...REAL_8WK_EVENTS.map(e => ({ ...e, suite: 'real_8wk' })), ...plantedEvents];
  const pilotSet = new Set(PILOT_EVENT_IDS);
  const events = IDS_ARG
    ? fullEvents.filter(e => IDS_ARG.has(e.id))
    : (IS_PILOT ? fullEvents.filter(e => pilotSet.has(e.id)) : fullEvents);
  console.log(`Replaying ${events.length} chronological events (${events.filter(e => e.kind === 'code_pr').length} code PRs, ${events.filter(e => e.kind === 'human_docs_pr').length} human .mdx PRs)...`);

  const armsToRun = ARM_ARG === 'baseline'
    ? ['baseline_agent']
    : ARM_ARG === 'ia'
      ? ['ia_assisted_agent']
      : ['baseline_agent', 'ia_assisted_agent'];

  const resultsArr = await Promise.all(
    armsToRun.map(arm => runArmStream({ arm, events, productConfig, t0Data, parseAst, cleanEnv, settingsCheck }))
  );

  const byArm = Object.fromEntries(resultsArr.map(r => [r.arm, r]));
  const report = {
    generatedAt: new Date().toISOString(),
    mode: IS_PILOT ? 'pilot' : 'full',
    tag: TAG_ARG,
    model: MODEL,
    effort: EFFORT,
    window: { startDate: '2026-10-03', endDate: '2026-11-23', includesPlantedHard: true },
    prompts: {
      baseline_agent: BASELINE_SYSTEM_RULES,
      ia_assisted_agent: IA_DECISION_TREE_RULES,
    },
    eventCount: events.length,
    codePrCount: events.filter(e => e.kind === 'code_pr').length,
    humanDocsPrCount: events.filter(e => e.kind === 'human_docs_pr').length,
    arms: byArm,
  };

  const reportPath = join(RESULTS_DIR, 'scorecard.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved stateful scorecard -> ${reportPath}`);
  for (const arm of armsToRun) {
    console.log(`\n[${arm}] Final:`, JSON.stringify(byArm[arm].finalRunning, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
