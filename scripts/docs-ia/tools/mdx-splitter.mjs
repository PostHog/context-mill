// Source-first Markdown/MDX splitter + 3-tier human `.mdx` soft-drift reconciler (0 LLM).
import { normalizeQuoteForIdentity } from '../models/fact.mjs';
import { normalizeLineEndings } from '../models/pin.mjs';

export function stripMdxMarkup(text) {
  return String(text ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>/gi, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[`*~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferDocSurfaceHint(pagePath, headingPath, text, surfaceHints = []) {
  for (const rule of surfaceHints) {
    const hay = rule.scope === 'text' ? text : `${pagePath} ${headingPath}`;
    const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
    if (re.test(hay)) return rule.surface;
  }
  const pathAndHeading = `${pagePath} ${headingPath}`.toLowerCase();
  if (/\/surfaces\/web-app\.mdx$/.test(pathAndHeading)) return 'UI';
  if (/\/surfaces\/api\.mdx$/.test(pathAndHeading)) return 'API';
  if (/\/surfaces\/mcp\.mdx$/.test(pathAndHeading)) return 'MCP';
  if (/\/ios\.mdx$|\bios\b/.test(pathAndHeading)) return 'IOS';
  if (/\/android\.mdx$|\bandroid\b/.test(pathAndHeading)) return 'AND';
  if (/\/flutter\.mdx$|\bflutter\b/.test(pathAndHeading)) return 'FLT';
  if (/\/react-native\.mdx$|react[\s-]native/.test(pathAndHeading)) return 'RN';
  if (/\/python\.mdx$|\bpython\b/.test(pathAndHeading)) return 'PY';
  if (/\/rust\.mdx$|\brust\b/.test(pathAndHeading)) return 'RS';
  if (/\/typescript\.mdx$|\btypescript\b/.test(pathAndHeading)) return 'TS';
  if (/\/webmcp\.mdx$|\bweb\b/.test(pathAndHeading)) return 'WEB';
  return 'ALL';
}

/**
 * Split one MDX file into atomic pieces:
 *   - frontmatter, imports, headings -> `structural`
 *   - images, ProductScreenshot, ProductVideo -> `unverified`
 *   - paragraphs, list items, table data rows, JSX callouts, code blocks -> `mappable: true`
 */
export function splitMdxFile(pagePath, rawText, { surfaceHints = [] } = {}) {
  const lines = normalizeLineEndings(rawText).split('\n');
  const pieces = [];
  let i = 0;
  let headingStack = [];

  const pushPiece = (kind, startLine, endLine, text, extra = {}) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const plainText = kind === 'code' ? trimmed.slice(0, 260) : stripMdxMarkup(trimmed);
    const headingPath = headingStack.map(h => h.title).join(' > ');
    const isMedia = /^(?:!\[[^\]]*\]\([^)]+\)|<(?:ProductScreenshot|ProductVideo|img|video)\b)/i.test(trimmed);
    const isStructural = kind === 'frontmatter' || kind === 'import' || kind === 'heading' || (!plainText && !isMedia);
    const preState = isStructural ? 'structural' : (isMedia ? 'unverified' : null);
    const mappable = !isStructural && !isMedia && plainText.length >= 16;

    pieces.push({
      pieceId: `${pagePath}#L${startLine}-L${endLine}`,
      pagePath,
      pageUrl: `https://posthog.com/${pagePath.replace(/^contents\//, '').replace(/\/index\.mdx$/, '').replace(/\.mdx$/, '')}`,
      kind,
      headingPath,
      startLine,
      endLine,
      text: trimmed,
      plainText,
      mappable,
      preState: preState || (plainText.length < 16 ? 'structural' : null),
      surfaceHint: inferDocSurfaceHint(pagePath, headingPath, trimmed, surfaceHints),
      ...extra,
    });
  };

  if (lines[0]?.trim() === '---') {
    let end = 1;
    while (end < lines.length && lines[end].trim() !== '---') end++;
    pushPiece('frontmatter', 1, Math.min(end + 1, lines.length), lines.slice(0, end + 1).join('\n'));
    i = end + 1;
  }

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; continue; }

    if (/^(import|export)\s/.test(trimmed)) {
      const start = i + 1;
      let end = i;
      while (end + 1 < lines.length && !/[;{}]$/.test(lines[end].trim()) && lines[end + 1].trim() !== '') end++;
      pushPiece('import', start, end + 1, lines.slice(i, end + 1).join('\n'));
      i = end + 1;
      continue;
    }

    const hm = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (hm) {
      const level = hm[1].length;
      headingStack = headingStack.filter(h => h.level < level);
      headingStack.push({ level, title: stripMdxMarkup(hm[2]) });
      pushPiece('heading', i + 1, i + 1, trimmed);
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const start = i + 1;
      let end = i + 1;
      while (end < lines.length && !lines[end].trim().startsWith('```')) end++;
      pushPiece('code', start, Math.min(end + 1, lines.length), lines.slice(i, Math.min(end + 1, lines.length)).join('\n'));
      i = end + 1;
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:-]+\|/.test(lines[i + 1])) {
      const hdrCols = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      pushPiece('heading', i + 1, i + 2, `${trimmed}\n${lines[i + 1].trim()}`);
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        pushPiece('table_row', i + 1, i + 1, lines[i].trim(), { tableColumns: hdrCols });
        i++;
      }
      continue;
    }

    if (/^(?:[-*+]|\d+[.)])\s+/.test(trimmed)) {
      const start = i + 1;
      let end = i;
      while (
        end + 1 < lines.length &&
        lines[end + 1].trim() !== '' &&
        !/^(?:[-*+]|\d+[.)]|#{1,6}|```|\|)\s*/.test(lines[end + 1].trim()) &&
        /^\s{2,}/.test(lines[end + 1])
      ) end++;
      pushPiece('list_item', start, end + 1, lines.slice(i, end + 1).join('\n'));
      i = end + 1;
      continue;
    }

    if (/^<[A-Z]/.test(trimmed)) {
      const start = i + 1;
      let end = i;
      if (!/\/>$/.test(trimmed) && !/<\/[A-Z][^>]*>$/.test(trimmed)) {
        const tag = /^<([A-Za-z0-9_.]+)/.exec(trimmed)?.[1];
        while (end + 1 < lines.length && (!tag || !lines[end].includes(`</${tag}>`)) && !/\/>$/.test(lines[end].trim())) {
          end++;
          if (end - i > 30) break;
        }
      }
      pushPiece('jsx', start, end + 1, lines.slice(i, end + 1).join('\n'));
      i = end + 1;
      continue;
    }

    const start = i + 1;
    let end = i;
    while (
      end + 1 < lines.length &&
      lines[end + 1].trim() !== '' &&
      !/^(?:#{1,6}\s|```|(?:[-*+]|\d+[.)])\s|\||<[A-Z]|import\s)/.test(lines[end + 1].trim())
    ) end++;
    pushPiece('paragraph', start, end + 1, lines.slice(i, end + 1).join('\n'));
    i = end + 1;
  }

  return pieces;
}

function shingleSet(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[`*_#>\[\]()]/g, ' ')
    .match(/[a-z0-9$_.@-]{2,}/g) || [];
  if (words.length < 3) return new Set(words);
  const out = new Set();
  for (let i = 0; i <= words.length - 3; i++) {
    out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return out;
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * 3-tier deterministic reconciler for uncooperative human `.mdx` edits (0 LLM calls):
 *   Tier 1: exact text on same page -> stays `fresh` (updates line numbers)
 *   Tier 2: exact text moved to another page -> updates `pagePath`, stays `fresh`
 *   Tier 3: token-shingle similarity match -> preserves `claimCode` & `factCodes`, flips to `unverified_human`
 */
export function reconcileHumanMdxDrift({ prevClaims = [], nextPieces = [], docsCommit = null }) {
  const usedPieceIds = new Set();
  const nextByNorm = new Map();
  const nextWithShingles = nextPieces.map(p => {
    const norm = normalizeQuoteForIdentity(p.plainText || p.text);
    const rec = { ...p, norm, shingles: shingleSet(p.plainText || p.text) };
    if (norm) {
      if (!nextByNorm.has(norm)) nextByNorm.set(norm, []);
      nextByNorm.get(norm).push(rec);
    }
    return rec;
  });

  const reconciledClaims = [];
  const retiredClaimCodes = [];
  let exactSamePage = 0;
  let movedCrossPage = 0;
  let humanEdited = 0;

  for (const cl of prevClaims) {
    const norm = normalizeQuoteForIdentity(cl.plainText || cl.text);
    const exactCands = (nextByNorm.get(norm) || []).filter(p => !usedPieceIds.has(p.pieceId));
    const samePageHit = exactCands.find(p => p.pagePath === cl.pagePath);
    if (samePageHit) {
      usedPieceIds.add(samePageHit.pieceId);
      exactSamePage++;
      reconciledClaims.push({
        ...cl,
        pieceId: samePageHit.pieceId,
        headingPath: samePageHit.headingPath,
        startLine: samePageHit.startLine,
        endLine: samePageHit.endLine,
        docsCommit,
      });
      continue;
    }
    if (exactCands.length > 0) {
      const moved = exactCands[0];
      usedPieceIds.add(moved.pieceId);
      movedCrossPage++;
      reconciledClaims.push({
        ...cl,
        pieceId: moved.pieceId,
        pagePath: moved.pagePath,
        headingPath: moved.headingPath,
        startLine: moved.startLine,
        endLine: moved.endLine,
        docsCommit,
      });
      continue;
    }

    const clShingles = shingleSet(cl.plainText || cl.text);
    let best = null;
    let bestScore = 0;
    for (const cand of nextWithShingles) {
      if (usedPieceIds.has(cand.pieceId)) continue;
      const samePage = cand.pagePath === cl.pagePath;
      const sim = jaccard(clShingles, cand.shingles);
      const threshold = samePage ? 0.38 : 0.65;
      if (sim >= threshold && sim > bestScore) {
        best = cand;
        bestScore = sim;
      }
    }
    if (best) {
      usedPieceIds.add(best.pieceId);
      humanEdited++;
      reconciledClaims.push({
        ...cl,
        pieceId: best.pieceId,
        pagePath: best.pagePath,
        headingPath: best.headingPath,
        text: best.text,
        plainText: best.plainText,
        startLine: best.startLine,
        endLine: best.endLine,
        state: 'unverified_human',
        driftSimilarity: Number(bestScore.toFixed(3)),
        docsCommit,
      });
    } else {
      retiredClaimCodes.push(cl.claimCode || cl.code);
    }
  }

  const unmappedNewPieces = nextWithShingles
    .filter(p => !usedPieceIds.has(p.pieceId) && p.mappable)
    .map(({ shingles, norm, ...rest }) => rest);

  return {
    reconciledClaims,
    retiredClaimCodes,
    unmappedNewPieces,
    stats: {
      prevTotal: prevClaims.length,
      exactSamePage,
      movedCrossPage,
      humanEdited,
      retiredDeleted: retiredClaimCodes.length,
      unmappedNewPieces: unmappedNewPieces.length,
    },
  };
}
