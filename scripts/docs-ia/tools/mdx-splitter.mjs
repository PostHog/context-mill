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

    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fenceMatch) {
      const fenceChar = fenceMatch[1][0];
      const fenceLen = fenceMatch[1].length;
      const closeRe = new RegExp(`^${fenceChar}{${fenceLen},}\\s*$`);
      const start = i + 1;
      let end = i + 1;
      while (end < lines.length && !closeRe.test(lines[end].trim())) end++;
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
        !/^(?:[-*+]|\d+[.)]|#{1,6}|```|~~~|\||<\/?[A-Z])\s*/.test(lines[end + 1].trim()) &&
        /^\s{2,}/.test(lines[end + 1])
      ) end++;
      pushPiece('list_item', start, end + 1, lines.slice(i, end + 1).join('\n'));
      i = end + 1;
      continue;
    }

    // Standalone closing JSX tag (e.g. `</Steps>`, `</Step>`, `</MultiLanguage>`, `</CalloutBox>`)
    if (/^<\/[A-Za-z][A-Za-z0-9_.]*\s*>$/.test(trimmed)) {
      pushPiece('jsx', i + 1, i + 1, trimmed);
      i++;
      continue;
    }

    // Opening JSX component tag: scan opening tag attributes up to `>` / `/>` without ever crossing a code fence.
    // Block wrappers (`<Steps>`, `<Step>`, `<MultiLanguage>`, `<QuestLog>`, `<Tab.*>`, or any tag wrapping
    // markdown blocks/code fences) emit only the opening wrapper tag as structural `jsx` so inner markdown
    // and fenced code blocks parse cleanly without fence inversion.
    if (/^<[A-Z]/.test(trimmed)) {
      const start = i + 1;
      const tag = /^<([A-Za-z0-9_.]+)/.exec(trimmed)?.[1];
      let openEnd = i;
      while (
        openEnd + 1 < lines.length &&
        !/>$/.test(lines[openEnd].trim()) &&
        !/^(`{3,}|~{3,})/.test(lines[openEnd + 1].trim()) &&
        lines[openEnd + 1].trim() !== '' &&
        openEnd - i < 20
      ) {
        openEnd++;
      }
      const openBlock = lines.slice(i, openEnd + 1).join('\n');
      const isSelfClosedOrInlineClosed =
        /\/>$/.test(lines[openEnd].trim()) ||
        (tag && openBlock.includes(`</${tag}>`));

      if (isSelfClosedOrInlineClosed) {
        pushPiece('jsx', start, openEnd + 1, openBlock);
        i = openEnd + 1;
        continue;
      }

      const isKnownContainer = Boolean(
        tag && /^(Steps|Step|MultiLanguage|QuestLog|QuestLogItem|Tab(\..+)?|OnboardingContentWrapper|OSButtonGroup)$/i.test(tag)
      );

      // For short inline-text JSX components (e.g. a 3-line <CalloutBox> or <CallToAction> with no code fences
      // or nested block elements), keep the full component as one `jsx` piece; otherwise emit only the opening tag.
      let closedEnd = -1;
      if (!isKnownContainer && tag) {
        let sawUnsafeInner = false;
        for (let k = openEnd + 1; k < lines.length && k - i <= 12; k++) {
          const kt = lines[k].trim();
          if (/^(`{3,}|~{3,})/.test(kt) || /^#{1,6}\s/.test(kt) || /^<[A-Z]/.test(kt)) {
            sawUnsafeInner = true;
            break;
          }
          if (kt.includes(`</${tag}>`)) {
            closedEnd = k;
            break;
          }
        }
        if (sawUnsafeInner) closedEnd = -1;
      }

      if (closedEnd >= 0) {
        pushPiece('jsx', start, closedEnd + 1, lines.slice(i, closedEnd + 1).join('\n'));
        i = closedEnd + 1;
      } else {
        pushPiece('jsx', start, openEnd + 1, openBlock);
        i = openEnd + 1;
      }
      continue;
    }

    const start = i + 1;
    let end = i;
    while (
      end + 1 < lines.length &&
      lines[end + 1].trim() !== '' &&
      !/^(?:#{1,6}\s|```|~~~|(?:[-*+]|\d+[.)])\s|\||<\/?[A-Z]|import\s)/.test(lines[end + 1].trim())
    ) end++;
    pushPiece('paragraph', start, end + 1, lines.slice(i, end + 1).join('\n'));
    i = end + 1;
  }

  return pieces;
}

function wordTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[`*_#>\[\]()]/g, ' ')
    .match(/[a-z0-9$_.@-]{2,}/g) || [];
}

function codeIdentifiers(rawText) {
  return new Set([...String(rawText || '').matchAll(/`([^`\n]{2,60})`/g)].map(m => m[1].toLowerCase()));
}

function softDriftSimilarity(prevText, prevRaw, nextText, nextRaw) {
  const wA = wordTokens(prevText);
  const wB = wordTokens(nextText);
  if (!wA.length || !wB.length) return 0;
  const uni = jaccard(new Set(wA), new Set(wB));
  const biA = new Set(wA.slice(0, -1).map((w, i) => `${w} ${wA[i + 1]}`));
  const biB = new Set(wB.slice(0, -1).map((w, i) => `${w} ${wB[i + 1]}`));
  const bi = biA.size && biB.size ? jaccard(biA, biB) : uni;
  const idA = codeIdentifiers(prevRaw);
  const idB = codeIdentifiers(nextRaw);
  const idBonus = idA.size && idB.size ? 0.2 * jaccard(idA, idB) : 0;
  return Math.min(1, 0.6 * uni + 0.4 * bi + idBonus);
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
  const nextWithTokens = nextPieces.map(p => {
    const norm = normalizeQuoteForIdentity(p.plainText || p.text);
    const rec = { ...p, norm };
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

    let best = null;
    let bestScore = 0;
    for (const cand of nextWithTokens) {
      if (usedPieceIds.has(cand.pieceId)) continue;
      const samePage = cand.pagePath === cl.pagePath;
      const sim = softDriftSimilarity(cl.plainText || cl.text, cl.text, cand.plainText || cand.text, cand.text);
      const threshold = samePage ? 0.36 : 0.65;
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

  const unmappedNewPieces = nextWithTokens
    .filter(p => !usedPieceIds.has(p.pieceId) && p.mappable)
    .map(({ norm, ...rest }) => rest);

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
