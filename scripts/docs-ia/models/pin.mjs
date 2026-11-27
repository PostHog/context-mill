// Detached source pin model: `{ commit, code_hash, own_lines? }`.
//
// Why commit and code_hash are detached:
//   1. Outer gate (`commit`): if repo HEAD === pin.commit, skip reading & hashing (0 I/O, 0 LLM).
//   2. Inner gate (`code_hash`): if repo HEAD moved (1, 15, or 100 commits), re-hash the pinned
//      symbol's `ownLines`. If MD5 matches, bump `commit` to HEAD and mark `fresh` (0 LLM).
//   3. Only changed MD5s wake a judge (`recheck` when verbatim quote survives, `stale` when gone,
//      `gone` when the file or symbol was removed).
import { createHash } from 'node:crypto';

export function normalizeLineEndings(text) {
  return String(text ?? '').replaceAll('\r\n', '\n');
}

export function codeMd5(text) {
  return createHash('md5').update(normalizeLineEndings(text)).digest('hex');
}

export function shortSha256(text, length = 12) {
  return createHash('sha256').update(String(text ?? '')).digest('hex').slice(0, length);
}

/**
 * Compact sorted line numbers into inclusive `[start, end]` runs for lossless storage.
 * Example: `[10, 11, 12, 18, 19]` -> `[[10, 12], [18, 19]]`.
 */
export function compactLineRuns(ownLines) {
  const sorted = [...new Set((ownLines || []).map(Number).filter(n => Number.isInteger(n) && n > 0))]
    .sort((a, b) => a - b);
  if (!sorted.length) return [];
  const runs = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      runs.push([start, end]);
      start = sorted[i];
      end = sorted[i];
    }
  }
  runs.push([start, end]);
  return runs;
}

/** Expand inclusive `[start, end]` line runs back into sorted 1-based line numbers. */
export function expandLineRuns(runs) {
  const out = [];
  for (const [start, end] of runs || []) {
    for (let ln = start; ln <= end; ln++) out.push(ln);
  }
  return out;
}

/** Extract the exact text slice owned by `ownLines` from full file source. */
export function sliceOwnLines(fileText, ownLines) {
  const lines = normalizeLineEndings(fileText).split('\n');
  return (ownLines || []).map(ln => lines[ln - 1] ?? '').join('\n');
}

/** Build a detached pin object `{ commit, code_hash, own_runs? }`. */
export function createDetachedPin({ commit, text, ownLines = null, quote = null }) {
  if (!commit) throw new Error('commit hash is required for a detached pin');
  const pin = {
    commit: String(commit),
    code_hash: codeMd5(text),
  };
  if (Array.isArray(ownLines) && ownLines.length > 0) {
    pin.own_runs = compactLineRuns(ownLines);
  }
  if (quote) pin.quote = String(quote);
  return pin;
}

/** Format a detached pin as the compact string `<commit>-<code_hash>`. */
export function formatPin(pin) {
  if (!pin?.commit || !pin?.code_hash) throw new Error('Detached pin requires { commit, code_hash }');
  return `${pin.commit}-${pin.code_hash}`;
}

/** Parse `<commit>-<code_hash>` into `{ commit, code_hash }`. */
export function parsePin(pinOrString) {
  if (pinOrString && typeof pinOrString === 'object') {
    return {
      commit: String(pinOrString.commit ?? ''),
      code_hash: String(pinOrString.code_hash ?? pinOrString.codeHash ?? ''),
      own_runs: pinOrString.own_runs,
      quote: pinOrString.quote,
    };
  }
  const s = String(pinOrString ?? '');
  const i = s.lastIndexOf('-');
  if (i <= 0) return { commit: '', code_hash: '' };
  return { commit: s.slice(0, i), code_hash: s.slice(i + 1) };
}

/**
 * Pure two-gate refresh of a detached pin against a newer repo commit.
 * `getSliceText` is only invoked when `headCommit !== pin.commit`.
 */
export function refreshDetachedPin({ pin, headCommit, getSliceText, quote = null }) {
  const parsed = parsePin(pin);
  if (!parsed.commit || !parsed.code_hash) {
    throw new Error('Detached pin requires { commit, code_hash }');
  }
  if (!headCommit) throw new Error('headCommit is required');

  // Outer gate: repo HEAD hasn't moved -> skip file read and MD5 completely.
  if (parsed.commit === headCommit) {
    return {
      state: 'fresh',
      pin: parsed,
      bumped: false,
      hashChecked: false,
      llmCalls: 0,
    };
  }

  // Inner gate: re-hash the pinned symbol slice at headCommit.
  const text = typeof getSliceText === 'function' ? getSliceText() : getSliceText;
  if (text === null || text === undefined) {
    return {
      state: 'gone',
      pin: parsed,
      candidatePin: null,
      bumped: false,
      hashChecked: true,
      llmCalls: 0,
    };
  }

  const normText = normalizeLineEndings(text);
  const nextHash = codeMd5(normText);
  if (nextHash === parsed.code_hash) {
    return {
      state: 'fresh',
      pin: { ...parsed, commit: headCommit, code_hash: parsed.code_hash },
      bumped: true,
      hashChecked: true,
      llmCalls: 0,
    };
  }

  const expectedQuote = quote ?? parsed.quote ?? null;
  const quotePresent = expectedQuote
    ? normText.includes(normalizeLineEndings(expectedQuote))
    : true;

  return {
    state: quotePresent ? 'recheck' : 'stale',
    pin: parsed,
    candidatePin: { ...parsed, commit: headCommit, code_hash: nextHash },
    bumped: false,
    hashChecked: true,
    llmCalls: 0,
  };
}
