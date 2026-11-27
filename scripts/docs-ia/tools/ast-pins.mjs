// Product-agnostic AST/YAML symbol indexer and detached `{ commit, code_hash }` pin builder.
//
// Accepts an optional Tree-sitter `declarationIndex` adapter (e.g. `web-tree-sitter` from docmap)
// and falls back to a deterministic built-in JS/TS/Python/Rust/YAML declaration extractor when
// Tree-sitter WASM is not passed, so unit tests and lightweight runs work with zero extra deps.
import { extname } from 'node:path';
import yaml from 'js-yaml';
import { createDetachedPin, normalizeLineEndings } from '../models/pin.mjs';

export const MODULE_SYMBOL = '<module>';
const DEFAULT_BATCH_LINES = 250;
const MEGA_DEF_LINES = 500;
const WINDOW_LINES = 380;
const WINDOW_OVERLAP = 20;

const TEST_OR_GEN_RE = /(\/tests?\/|\/__tests__\/|\.test\.|\.spec\.|\.stories\.|\/migrations\/|__init__\.py$|\/generated\/|\/harness\/|\/examples\/|vitest\.config|tsconfig\.json|package\.json|turbo\.json|\.scss$|\.md$)/i;

export function isWatchedManifest(repo, relPath, productConfig = {}, contentOrDiff = '') {
  for (const rule of productConfig.watched_manifests || []) {
    if (rule.repo && rule.repo !== repo) continue;
    const pathRe = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
    if (!pathRe.test(relPath)) continue;
    if (rule.content_pattern) {
      const contentRe = rule.content_pattern instanceof RegExp ? rule.content_pattern : new RegExp(rule.content_pattern, 'i');
      if (!contentRe.test(relPath) && !contentRe.test(contentOrDiff)) continue;
    }
    return true;
  }
  return false;
}

export function classifyFileExclusion(repo, relPath, productConfig = {}, contentOrDiff = '') {
  if (isWatchedManifest(repo, relPath, productConfig, contentOrDiff)) {
    return { excluded: false, decisionCode: null, reason: null };
  }
  if (TEST_OR_GEN_RE.test(relPath)) {
    return {
      excluded: true,
      decisionCode: `${productConfig.code || 'IA'}-ALL-D-EXCL-001`,
      reason: 'Tests, migrations, generated schemas, build configs, and markdown files',
    };
  }
  for (const rule of productConfig.exclusions || []) {
    if (rule.repo && rule.repo !== repo) continue;
    const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
    if (re.test(relPath)) {
      return {
        excluded: true,
        decisionCode: rule.code,
        reason: rule.reason || 'Explicit product IA exclusion rule',
      };
    }
  }
  return { excluded: false, decisionCode: null, reason: null };
}

export function surfaceForPath(repo, relPath, productConfig = {}) {
  for (const rule of productConfig.surface_rules || []) {
    if (rule.repo && rule.repo !== repo) continue;
    if (!rule.pattern) return rule.surface;
    const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
    if (re.test(relPath)) return rule.surface;
  }
  if (repo === 'posthog') {
    if (relPath.includes('/mcp/') || relPath.endsWith('tools.yaml')) return 'MCP';
    if (relPath.includes('/frontend/') || relPath.endsWith('manifest.tsx')) return 'UI';
    return 'API';
  }
  if (repo === 'posthog-js') {
    if (relPath.includes('packages/react-native')) return 'RN';
    if (relPath.includes('packages/browser')) return 'WEB';
    return 'TS';
  }
  if (repo === 'posthog-ios') return 'IOS';
  if (repo === 'posthog-android') return 'AND';
  if (repo === 'posthog-flutter') return 'FLT';
  if (repo === 'posthog-python') return 'PY';
  if (repo === 'posthog-rs') return 'RS';
  return 'API';
}

function extractYamlTools(repo, commit, relPath, text, surface) {
  const lines = normalizeLineEndings(text).split('\n');
  let doc = null;
  try { doc = yaml.load(text); } catch { doc = null; }
  const out = [];

  if (doc?.tools && typeof doc.tools === 'object') {
    const keys = Object.keys(doc.tools);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const startIdx = lines.findIndex(l => new RegExp(`^\\s{2}${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(l));
      if (startIdx < 0) continue;
      let endIdx = startIdx;
      while (endIdx + 1 < lines.length) {
        const nextLine = lines[endIdx + 1];
        if (/^\S/.test(nextLine) || /^\s{2}[a-zA-Z0-9_-]+\s*:/.test(nextLine)) break;
        endIdx++;
      }
      const ownLines = [];
      for (let ln = startIdx + 1; ln <= endIdx + 1; ln++) ownLines.push(ln);
      const sliceText = ownLines.map(ln => lines[ln - 1]).join('\n');
      out.push({
        id: `${repo}:${relPath}#${key}`,
        repo,
        path: relPath,
        symbol: key,
        kind: 'yaml_tool',
        surface,
        start: ownLines[0],
        end: ownLines.at(-1),
        ownLines,
        lines: ownLines.length,
        sliceText,
        pin: createDetachedPin({ commit, text: sliceText, ownLines }),
      });
    }
  }

  if (!out.length) {
    const ownLines = lines.map((_, idx) => idx + 1);
    out.push({
      id: `${repo}:${relPath}#${MODULE_SYMBOL}`,
      repo,
      path: relPath,
      symbol: MODULE_SYMBOL,
      kind: 'yaml_doc',
      surface,
      start: 1,
      end: lines.length,
      ownLines,
      lines: lines.length,
      sliceText: normalizeLineEndings(text),
      pin: createDetachedPin({ commit, text, ownLines }),
    });
  }
  return out;
}

function extractHeuristicDecls(lines, ext) {
  const declStarts = [];
  const isPy = ext === '.py';
  const patterns = isPy
    ? [/^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/, /^class\s+([A-Za-z_][A-Za-z0-9_]*)/]
    : [
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
        /^(?:export\s+)?(?:abstract\s+)?(?:class|interface|enum|type)\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
        /^(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/,
        /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)/,
      ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const re of patterns) {
      const m = re.exec(line);
      if (m) {
        declStarts.push({ lineIdx: i, symbol: m[1], kind: line.includes('class') ? 'class' : 'function' });
        break;
      }
    }
  }

  const defs = [];
  for (let i = 0; i < declStarts.length; i++) {
    const start = declStarts[i].lineIdx;
    const end = i + 1 < declStarts.length ? declStarts[i + 1].lineIdx - 1 : lines.length - 1;
    let trimmedEnd = end;
    while (trimmedEnd > start && lines[trimmedEnd].trim() === '') trimmedEnd--;
    const ownLines = [];
    for (let ln = start + 1; ln <= trimmedEnd + 1; ln++) {
      if (lines[ln - 1].trim() !== '') ownLines.push(ln);
    }
    if (ownLines.length) {
      defs.push({ symbol: declStarts[i].symbol, kind: declStarts[i].kind, ownLines });
    }
  }
  return defs;
}

/**
 * Index one source file into standalone symbol definitions with exact `ownLines`
 * and detached `{ commit, code_hash, own_runs }` pins.
 */
export async function indexSourceFile({
  repo,
  commit,
  path: relPath,
  text,
  productConfig = {},
  parseAst = null,
}) {
  if (text === null || text === undefined) return [];
  const norm = normalizeLineEndings(text);
  const ext = extname(relPath).toLowerCase();
  const surface = surfaceForPath(repo, relPath, productConfig);

  if (ext === '.yml' || ext === '.yaml') {
    return extractYamlTools(repo, commit, relPath, norm, surface);
  }

  const lines = norm.split('\n');
  if ((ext === '.md' || ext === '.mdx') && isWatchedManifest(repo, relPath, productConfig, norm)) {
    const ownLines = lines.map((_, idx) => idx + 1);
    return [{
      id: `${repo}:${relPath}#<release_manifest>`,
      repo,
      path: relPath,
      symbol: '<release_manifest>',
      kind: 'release_manifest',
      surface,
      start: 1,
      end: lines.length,
      ownLines,
      lines: lines.length,
      sliceText: norm,
      pin: createDetachedPin({ commit, text: norm, ownLines }),
    }];
  }
  let rawDefs = null;
  if (typeof parseAst === 'function') {
    rawDefs = await parseAst({ repo, commit, path: relPath, ext, text: norm, lines });
  }
  if (!rawDefs) {
    rawDefs = extractHeuristicDecls(lines, ext);
  }

  if (!rawDefs.length) {
    const nonImport = lines
      .map((t, idx) => [idx + 1, t.trim()])
      .filter(([, t]) => t && !/^(import\s|export\s+\*\s+from\s|from\s+\S+\s+import\s|use\s+|\/\/|#)/.test(t))
      .map(([ln]) => ln);
    if (!nonImport.length) return [];
    rawDefs = [{ symbol: MODULE_SYMBOL, kind: 'module', ownLines: nonImport }];
  }

  return rawDefs
    .filter(d => Array.isArray(d.ownLines) && d.ownLines.length > 0)
    .map(d => {
      const sliceText = d.ownLines.map(ln => lines[ln - 1] ?? '').join('\n');
      return {
        id: `${repo}:${relPath}#${d.symbol}`,
        repo,
        path: relPath,
        symbol: d.symbol,
        kind: d.kind || 'function',
        surface,
        start: d.ownLines[0],
        end: d.ownLines.at(-1),
        ownLines: d.ownLines,
        lines: d.ownLines.length,
        sliceText,
        pin: createDetachedPin({ commit, text: sliceText, ownLines: d.ownLines }),
      };
    })
    .sort((a, b) => a.start - b.start);
}

/**
 * Split oversized definitions (>500 lines) into overlapping 380-line windows and group smaller
 * definitions by file into bounded line batches for cheap extraction models.
 */
export function planSymbolBatches(defs, { batchLines = DEFAULT_BATCH_LINES } = {}) {
  const expanded = [];
  for (const d of defs) {
    if (d.lines <= MEGA_DEF_LINES) {
      expanded.push({ ...d, window: null });
      continue;
    }
    for (let start = 0; start < d.ownLines.length; start += WINDOW_LINES - WINDOW_OVERLAP) {
      const winLines = d.ownLines.slice(start, start + WINDOW_LINES);
      if (!winLines.length) break;
      const lines = normalizeLineEndings(d.sliceText).split('\n');
      const winText = lines.slice(start, start + WINDOW_LINES).join('\n');
      expanded.push({
        ...d,
        ownLines: winLines,
        lines: winLines.length,
        sliceText: winText,
        window: `${winLines[0]}-${winLines.at(-1)}`,
      });
      if (start + WINDOW_LINES >= d.ownLines.length) break;
    }
  }

  const byFile = new Map();
  for (const d of expanded) {
    const key = `${d.repo}:${d.path}`;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(d);
  }

  const batches = [];
  for (const [fileKey, fileDefs] of byFile.entries()) {
    let cur = [];
    let curLines = 0;
    for (const d of fileDefs) {
      if (cur.length && curLines + d.lines > batchLines) {
        batches.push({ fileKey, defs: cur, totalLines: curLines, large: curLines >= 150 });
        cur = [];
        curLines = 0;
      }
      cur.push(d);
      curLines += d.lines;
    }
    if (cur.length) {
      batches.push({ fileKey, defs: cur, totalLines: curLines, large: curLines >= 150 });
    }
  }
  return batches;
}
