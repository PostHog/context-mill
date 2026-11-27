// Zero-dependency local SQLite + FTS5 BM25 fact store, roundtrip serializer, & retriever
// (Node 22 built-in `node:sqlite`).
// Rebuilt deterministically on every run so both the docs-mapping pipeline (exact symbol + BM25 +
// cross-product seam lookup) and local CLI/agent ad-hoc queries run in <2ms.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'posthog',
  'can', 'are', 'you', 'when', 'how', 'use', 'using', 'not', 'only', 'also',
  'will', 'have', 'has', 'been', 'does', 'true', 'false', 'null', 'none', 'more',
  'all', 'any', 'each', 'other', 'than', 'then', 'they', 'their', 'what', 'which',
]);

function removeDbFiles(dbPath) {
  if (!dbPath || dbPath === ':memory:') return;
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
}

export function openFactsDb(dbPath, { reset = false } = {}) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
    if (reset) removeDbFiles(dbPath);
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS facts (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      product TEXT NOT NULL,
      fact_idx INTEGER NOT NULL,
      fact_code TEXT,
      leaf_key TEXT NOT NULL,
      def_id TEXT NOT NULL,
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      symbol TEXT NOT NULL,
      surface TEXT NOT NULL,
      section_key TEXT,
      fact_type TEXT,
      claim TEXT NOT NULL,
      quote TEXT NOT NULL,
      port_kind TEXT,
      port_dir TEXT,
      port_key TEXT,
      feature_flags TEXT,
      feature_flags_json TEXT,
      lines TEXT,
      pin TEXT,
      pin_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_facts_product ON facts(product);
    CREATE INDEX IF NOT EXISTS idx_facts_symbol ON facts(symbol);
    CREATE INDEX IF NOT EXISTS idx_facts_port_key ON facts(port_key);
    CREATE INDEX IF NOT EXISTS idx_facts_leaf ON facts(product, leaf_key);

    CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
      symbol,
      port_key,
      quote,
      claim,
      path,
      feature_flags,
      product UNINDEXED,
      content='facts',
      content_rowid='rowid',
      tokenize="porter unicode61 tokenchars '_-$/.'"
    );
  `);
  return db;
}

function serializeFeatureFlags(featureFlags) {
  if (featureFlags === undefined || featureFlags === null) {
    return { text: '', json: null };
  }
  if (Array.isArray(featureFlags)) {
    const text = featureFlags
      .map(x => (typeof x === 'string' ? x : `${x.flag}(${x.scope || ''})`))
      .join(' ');
    return { text, json: JSON.stringify(featureFlags) };
  }
  return { text: String(featureFlags), json: JSON.stringify(featureFlags) };
}

function serializePin(f) {
  const rawPin = f.pin;
  if (rawPin && typeof rawPin === 'object') {
    const pinStr = f.pinStr || (rawPin.commit && rawPin.code_hash ? `${rawPin.commit}-${rawPin.code_hash}` : '');
    return { text: pinStr, json: JSON.stringify(rawPin) };
  }
  const str = typeof rawPin === 'string' ? rawPin : String(f.pinStr || '');
  return { text: str, json: rawPin !== undefined ? JSON.stringify(rawPin) : null };
}

function formatLinesValue(lines) {
  if (Array.isArray(lines)) return lines.filter(x => x !== null && x !== undefined && x !== '').join('-');
  return lines === null || lines === undefined ? '' : String(lines);
}

export function insertFactsIntoDb(db, product, facts, { inTransaction = false } = {}) {
  const ins = db.prepare(`
    INSERT INTO facts (
      product, fact_idx, fact_code, leaf_key, def_id, repo, path, symbol, surface,
      section_key, fact_type, claim, quote, port_kind, port_dir, port_key,
      feature_flags, feature_flags_json, lines, pin, pin_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insFts = db.prepare(`
    INSERT INTO facts_fts (rowid, symbol, port_key, quote, claim, path, feature_flags, product)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  if (!inTransaction) db.exec('BEGIN');
  try {
    for (let i = 0; i < facts.length; i++) {
      const f = facts[i];
      const ff = serializeFeatureFlags(f.featureFlags);
      const pinInfo = serializePin(f);
      const portKey = f.port?.key ? String(f.port.key) : '';
      const info = ins.run(
        product,
        typeof f._idx === 'number' ? f._idx : i,
        f.factCode || f.code || '',
        f.leafKey || `${product}:${i}`,
        f.def || '',
        f.repo || '',
        f.path || '',
        f.symbol || '',
        f.surface || '',
        f.sectionKey || '',
        f.type || f.claim_type || 'fact',
        f.claim || '',
        f.quote || '',
        f.port?.kind || '',
        f.port?.dir || '',
        portKey,
        ff.text,
        ff.json,
        formatLinesValue(f.lines),
        pinInfo.text,
        pinInfo.json
      );
      insFts.run(
        info.lastInsertRowid,
        f.symbol || '',
        portKey,
        f.quote || '',
        f.claim || '',
        f.path || '',
        ff.text,
        product
      );
    }
    if (!inTransaction) db.exec('COMMIT');
  } catch (err) {
    if (!inTransaction) {
      try { db.exec('ROLLBACK'); } catch {}
    }
    throw err;
  }
}

function normalizeLoadedOutlineRefs(sections, product) {
  const out = [];
  let idx = 0;
  for (const sec of sections || []) {
    for (const ref of sec.refs || []) {
      const lineStr = formatLinesValue(ref.lines);
      const factCode = ref.factCode || ref.code || ref.id || '';
      out.push({
        _idx: idx++,
        factCode,
        leafKey: ref.leafKey || factCode || `${product}:${idx}`,
        def: ref.def || `${ref.repo || ''}:${ref.path || ''}#${ref.symbol || ''}`,
        repo: ref.repo || '',
        path: ref.path || '',
        symbol: ref.symbol || '',
        surface: ref.surface || '',
        sectionKey: ref.sectionKey || sec.key || '',
        type: ref.type || ref.claim_type || 'fact',
        claim: ref.claim || '',
        quote: ref.quote || '',
        port: ref.port || null,
        featureFlags: ref.featureFlags !== undefined ? ref.featureFlags : [],
        lines: lineStr,
        pin: ref.pin !== undefined ? ref.pin : '',
      });
    }
  }
  return out;
}

export function readFactsFromFile(filePath, product = '') {
  const raw = readFileSync(filePath, 'utf8');
  const ext = extname(filePath).toLowerCase();
  const parsed = ext === '.yml' || ext === '.yaml' ? yaml.load(raw) : JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.facts)) return parsed.facts;
  if (parsed && Array.isArray(parsed.sections)) return normalizeLoadedOutlineRefs(parsed.sections, product);
  if (parsed && Array.isArray(parsed.chapters)) {
    const sections = parsed.chapters.flatMap(ch => ch.sections || []);
    return normalizeLoadedOutlineRefs(sections, product);
  }
  return [];
}

/**
 * Build a SQLite + FTS5 facts database from one or more JSON or YAML facts/outline files
 * inside a single atomic transaction.
 */
export function buildFactsDbFromFiles({ files = [], dbPath, reset = true }) {
  const db = openFactsDb(dbPath, { reset });
  const counts = {};
  let total = 0;
  db.exec('BEGIN');
  try {
    for (const item of files) {
      const product = item.product;
      const facts = readFactsFromFile(item.path, product);
      insertFactsIntoDb(db, product, facts, { inTransaction: true });
      counts[product] = (counts[product] || 0) + facts.length;
      total += facts.length;
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    closeAndCleanupFactsDb(db, dbPath, { removeFiles: reset });
    throw err;
  }
  return { db, dbPath, counts, total };
}

function rowToExportedFact(r) {
  let featureFlags = [];
  if (r.feature_flags_json !== null && r.feature_flags_json !== undefined) {
    try { featureFlags = JSON.parse(r.feature_flags_json); } catch { featureFlags = []; }
  } else if (r.feature_flags) {
    featureFlags = r.feature_flags.split(/\s+/).filter(Boolean);
  }

  let pin = r.pin || '';
  if (r.pin_json !== null && r.pin_json !== undefined) {
    try { pin = JSON.parse(r.pin_json); } catch { pin = r.pin || ''; }
  }

  const port = r.port_kind || r.port_dir || r.port_key
    ? { kind: r.port_kind || '', dir: r.port_dir || '', key: r.port_key || '' }
    : null;

  return {
    factCode: r.fact_code || '',
    leafKey: r.leaf_key,
    def: r.def_id,
    repo: r.repo,
    path: r.path,
    symbol: r.symbol,
    surface: r.surface,
    sectionKey: r.section_key || '',
    type: r.fact_type || 'fact',
    claim: r.claim,
    quote: r.quote,
    port,
    featureFlags,
    lines: r.lines || '',
    pin,
  };
}

/**
 * Deterministically export all facts for a product (ordered by `leaf_key`, `fact_idx`, `rowid`)
 * as lossless structured objects suitable for deep-equal comparison or re-serialization.
 */
export function exportFactsFromDb(db, product) {
  const rows = db.prepare(`
    SELECT * FROM facts
    WHERE product = ?
    ORDER BY leaf_key ASC, fact_idx ASC, rowid ASC
  `).all(product);
  return rows.map(rowToExportedFact);
}

/**
 * Deterministically export a product's facts from SQLite back to a JSON or YAML file.
 */
export function exportFactsToFile(db, product, outPath, { format } = {}) {
  const facts = exportFactsFromDb(db, product);
  mkdirSync(dirname(outPath), { recursive: true });
  const ext = extname(outPath).toLowerCase();
  const fmt = format || (ext === '.yml' || ext === '.yaml' ? 'yaml' : 'json');
  const serialized = fmt === 'yaml'
    ? yaml.dump(facts, { lineWidth: 120, noRefs: true, sortKeys: false })
    : `${JSON.stringify(facts, null, 2)}\n`;
  writeFileSync(outPath, serialized, 'utf8');
  return { product, count: facts.length, path: outPath, facts };
}

/**
 * Flush WAL, close SQLite descriptor cleanly, and optionally delete the DB + `-wal`/`-shm` sidecars.
 */
export function closeAndCleanupFactsDb(db, dbPath = null, { removeFiles = false } = {}) {
  if (db) {
    try {
      if (dbPath && dbPath !== ':memory:') db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    try {
      db.close();
    } catch {}
  }
  if (removeFiles && dbPath && dbPath !== ':memory:') {
    removeDbFiles(dbPath);
  }
}

/**
 * Run an async or sync callback against an isolated temporary SQLite facts DB and guarantee
 * complete descriptor + file teardown on both success and thrown errors.
 */
export async function withTempFactsDb(fn, { prefix = 'facts-sqlite-', dir = tmpdir() } = {}) {
  const tmpDir = mkdtempSync(join(dir, prefix));
  const dbPath = join(tmpDir, 'facts.sqlite');
  const db = openFactsDb(dbPath, { reset: true });
  try {
    return await fn({ db, dbPath, tmpDir });
  } finally {
    closeAndCleanupFactsDb(db, dbPath, { removeFiles: true });
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function extractQueryTokens(rawText) {
  const src = String(rawText || '');
  const exactIdentifiers = new Set();

  // High-value backticked code identifiers, routes, event names, numbers, and camelCase/snake_case/kebab-case names
  for (const m of src.matchAll(/`([^`\n]{2,80})`/g)) {
    const inner = m[1].trim();
    for (const part of inner.split(/[\s(),;:=]+/)) {
      const clean = part.replace(/^['"]|['"]$/g, '').trim();
      if (clean.length >= 2 && /[a-zA-Z0-9_$]/.test(clean)) exactIdentifiers.add(clean);
    }
  }
  for (const m of src.matchAll(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+){1,}\b/g)) exactIdentifiers.add(m[0]);
  for (const m of src.matchAll(/\$[a-z0-9_]{2,}/gi)) exactIdentifiers.add(m[0]);
  for (const m of src.matchAll(/\/[a-z0-9_/:.-]{3,}/gi)) exactIdentifiers.add(m[0]);
  for (const m of src.matchAll(/\b[A-Z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g)) exactIdentifiers.add(m[0]);
  for (const m of src.matchAll(/\b[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*\b/g)) exactIdentifiers.add(m[0]);
  for (const m of src.matchAll(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/gi)) exactIdentifiers.add(m[0]);
  for (const m of src.matchAll(/\b\d{2,}\b/g)) exactIdentifiers.add(m[0]);

  const generalTerms = new Set();
  for (const tok of src.toLowerCase().replace(/[^a-z0-9_$/.-]+/g, ' ').split(/\s+/)) {
    const clean = tok.replace(/^[./-]+|[./-]+$/g, '');
    if (clean.length >= 3 && !STOP_WORDS.has(clean)) generalTerms.add(clean);
  }

  return {
    exactIdentifiers: [...exactIdentifiers].slice(0, 24),
    generalTerms: [...generalTerms].slice(0, 28),
  };
}

function escapeFtsTerm(t) {
  return `"${String(t).replace(/"/g, '""')}"`;
}

/**
 * Retrieve top candidate facts for one or more documentation pieces using FTS5 BM25
 * (column weights: symbol=6, port_key=8, quote=4, claim=3, path=1.5, flags=1) plus
 * exact identifier/symbol hits and optional surface boosts.
 */
export function queryFactsForPieces(db, pieces, { product, limit = 100, crossProduct = false, crossLimit = 28 } = {}) {
  // BM25 weights match FTS5 column order: symbol, port_key, quote, claim, path, feature_flags, product(unindexed)
  const inProdStmt = db.prepare(`
    SELECT f.product, f.fact_idx, f.surface, f.symbol, f.port_key,
           bm25(facts_fts, 6.0, 8.0, 4.0, 3.0, 1.5, 1.0) AS score
    FROM facts_fts
    JOIN facts f ON f.rowid = facts_fts.rowid
    WHERE facts_fts MATCH ? AND f.product = ?
    ORDER BY score ASC
    LIMIT ?
  `);
  const crossStmt = db.prepare(`
    SELECT f.product, f.fact_idx, f.surface, f.symbol, f.port_key,
           bm25(facts_fts, 6.0, 8.0, 4.0, 3.0, 1.5, 1.0) AS score
    FROM facts_fts
    JOIN facts f ON f.rowid = facts_fts.rowid
    WHERE facts_fts MATCH ? AND f.product != ?
    ORDER BY score ASC
    LIMIT ?
  `);

  const inScores = new Map(); // fact_idx -> score
  const crossScores = new Map(); // `${product}::${fact_idx}` -> { product, fact_idx, score }

  const addIn = (idx, boost) => inScores.set(idx, (inScores.get(idx) || 0) + boost);
  const addCross = (prod, idx, boost) => {
    const k = `${prod}::${idx}`;
    const prev = crossScores.get(k);
    if (prev) prev.score += boost;
    else crossScores.set(k, { product: prod, fact_idx: idx, score: boost });
  };

  for (const p of pieces) {
    const text = `${p.headingPath || ''}\n${p.text || p.plainText || ''}`;
    const { exactIdentifiers, generalTerms } = extractQueryTokens(text);

    // 1. Exact identifier query (high weight — ensures `vision-scanners-draft`, `isAvailable`, `1200`, `480`, `$ai_trace_id` always land)
    if (exactIdentifiers.length > 0) {
      const exactExpr = exactIdentifiers.map(escapeFtsTerm).join(' OR ');
      try {
        const rows = inProdStmt.all(exactExpr, product, 24);
        rows.forEach((r, rank) => {
          const surfBonus = p.surfaceHint && p.surfaceHint !== 'ALL' && r.surface === p.surfaceHint ? 8 : 0;
          addIn(r.fact_idx, 36 - rank + Math.min(20, -r.score) + surfBonus);
        });
      } catch {}
      if (crossProduct) {
        try {
          const crows = crossStmt.all(exactExpr, product, 10);
          crows.forEach((r, rank) => addCross(r.product, r.fact_idx, 26 - rank + Math.min(18, -r.score)));
        } catch {}
      }
    }

    // 2. General BM25 query across heading + piece text
    const allTerms = [...new Set([...exactIdentifiers, ...generalTerms])].slice(0, 30);
    if (allTerms.length > 0) {
      const expr = allTerms.map(escapeFtsTerm).join(' OR ');
      try {
        const rows = inProdStmt.all(expr, product, 24);
        rows.forEach((r, rank) => {
          const surfBonus = p.surfaceHint && p.surfaceHint !== 'ALL' && r.surface === p.surfaceHint ? 6 : 0;
          addIn(r.fact_idx, 24 - rank + Math.min(15, -r.score) + surfBonus);
        });
      } catch {}
      if (crossProduct) {
        try {
          const crows = crossStmt.all(expr, product, 8);
          crows.forEach((r, rank) => addCross(r.product, r.fact_idx, 16 - rank + Math.min(12, -r.score)));
        } catch {}
      }
    }
  }

  const inProductIndices = [...inScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(e => e[0]);

  const crossHits = crossProduct
    ? [...crossScores.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, crossLimit)
    : [];

  return { inProductIndices, crossHits };
}

/**
 * Convenience helper for ad-hoc local searching of `facts.sqlite`.
 */
export function searchFactsDb(db, query, { product = null, limit = 25 } = {}) {
  const { exactIdentifiers, generalTerms } = extractQueryTokens(query);
  const terms = [...new Set([...exactIdentifiers, ...generalTerms])].slice(0, 20);
  if (!terms.length) return [];
  const expr = terms.map(escapeFtsTerm).join(' OR ');
  const sql = product
    ? `SELECT f.*, bm25(facts_fts, 6.0, 8.0, 4.0, 3.0, 1.5, 1.0) AS rank FROM facts_fts JOIN facts f ON f.rowid = facts_fts.rowid WHERE facts_fts MATCH ? AND f.product = ? ORDER BY rank ASC LIMIT ?`
    : `SELECT f.*, bm25(facts_fts, 6.0, 8.0, 4.0, 3.0, 1.5, 1.0) AS rank FROM facts_fts JOIN facts f ON f.rowid = facts_fts.rowid WHERE facts_fts MATCH ? ORDER BY rank ASC LIMIT ?`;
  return product ? db.prepare(sql).all(expr, product, limit) : db.prepare(sql).all(expr, limit);
}
