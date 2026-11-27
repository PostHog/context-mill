import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import {
  buildFactsDbFromFiles,
  closeAndCleanupFactsDb,
  exportFactsFromDb,
  exportFactsToFile,
  insertFactsIntoDb,
  openFactsDb,
  queryFactsForPieces,
  searchFactsDb,
  withTempFactsDb,
} from '../tools/facts-sqlite.mjs';

function makeSampleFacts() {
  return [
    {
      factCode: 'TR-API-F-00001',
      leafKey: 'TR|API|posthog:rust/capture/src/otel/mod.rs#ingest_traces|route|a1',
      def: 'posthog:rust/capture/src/otel/mod.rs#ingest_traces',
      repo: 'posthog',
      path: 'rust/capture/src/otel/mod.rs',
      symbol: 'ingest_traces',
      surface: 'API',
      sectionKey: 'sec-otlp-ingestion',
      type: 'endpoint',
      claim: 'OTLP trace ingestion accepts protobuf or JSON payloads at `/i/v1/traces` with `$ai_trace_id` correlation.',
      quote: 'pub async fn ingest_traces() -> "/i/v1/traces" // $ai_trace_id',
      port: { kind: 'http', dir: 'in', key: '/i/v1/traces' },
      featureFlags: [
        { flag: 'TRACING_AI_EVENTS', scope: 'subfeature', via: 'caller', sourceFile: 'TraceAiEvents.tsx' },
      ],
      lines: '12-64',
      pin: { commit: 'deadbeef1234', code_hash: 'cafe0001', own_runs: [[12, 64]] },
    },
    {
      factCode: 'TR-TS-F-00002',
      leafKey: 'TR|TS|posthog-js:packages/browser/src/extensions/conversations/index.ts#isAvailable|method|b2',
      def: 'posthog-js:packages/browser/src/extensions/conversations/index.ts#isAvailable',
      repo: 'posthog-js',
      path: 'packages/browser/src/extensions/conversations/index.ts',
      symbol: 'isAvailable',
      surface: 'WEB',
      sectionKey: 'sec-widget-api',
      type: 'method',
      claim: 'Checks widget availability — handles unicode "café → 日本語" and single/double quotes `\'ok\'` cleanly.',
      quote: 'public isAvailable(): boolean { return Boolean(this._instance) && "café" !== \'no\'; }',
      port: null,
      featureFlags: [],
      lines: '88-96',
      pin: 'abcdef01-12345678',
    },
    {
      factCode: 'TR-MCP-F-00003',
      leafKey: 'TR|MCP|posthog:products/replay_vision/mcp/tools.yaml#vision-scanners-draft|tool|c3',
      def: 'posthog:products/replay_vision/mcp/tools.yaml#vision-scanners-draft',
      repo: 'posthog',
      path: 'products/replay_vision/mcp/tools.yaml',
      symbol: 'vision-scanners-draft',
      surface: 'MCP',
      sectionKey: 'sec-scanners',
      type: 'limit',
      claim: 'Video capture runs at 1200x480 resolution via MCP tool `vision-scanners-draft`.',
      quote: 'vision-scanners-draft: max_width=1200 max_height=480',
      port: { kind: 'mcp_tool', dir: 'in', key: 'vision-scanners-draft' },
      featureFlags: ['PRODUCT_REPLAY_VISION'],
      lines: '4-19',
      pin: { commit: '99887766', code_hash: '55443322' },
    },
  ];
}

describe('facts-sqlite roundtrip, lifecycle, and benchmark', () => {
  it('roundtrips JSON and YAML files losslessly (deep-equal + byte-identical re-export) with multi-product isolation', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'facts-rt-'));
    try {
      const sampleA = makeSampleFacts();
      const sampleB = [
        {
          factCode: 'SUP-WEB-F-00001',
          leafKey: 'SUP|WEB|posthog-js:packages/browser/src/conversations.ts#show|method|s1',
          def: 'posthog-js:packages/browser/src/conversations.ts#show',
          repo: 'posthog-js',
          path: 'packages/browser/src/conversations.ts',
          symbol: 'show',
          surface: 'WEB',
          sectionKey: 'sec-widget',
          type: 'method',
          claim: 'Opens the Support widget overlay programmatically via `posthog.conversations.show()`.',
          quote: 'show(): void { this._setOpen(true); }',
          port: null,
          featureFlags: [],
          lines: '101-108',
          pin: { commit: '1111aaaa', code_hash: '2222bbbb' },
        },
      ];

      // Intentionally shuffle input order to prove deterministic leafKey sorting on export
      const inJsonPath = join(tmpDir, 'tracing.in.json');
      const inYamlPath = join(tmpDir, 'support.in.yml');
      writeFileSync(inJsonPath, JSON.stringify([sampleA[2], sampleA[0], sampleA[1]], null, 2));
      writeFileSync(inYamlPath, yaml.dump(sampleB, { lineWidth: 120 }));

      const dbPath = join(tmpDir, 'roundtrip.sqlite');
      const built = buildFactsDbFromFiles({
        files: [
          { product: 'tracing', path: inJsonPath },
          { product: 'support', path: inYamlPath },
        ],
        dbPath,
        reset: true,
      });
      expect(built.counts).toEqual({ tracing: 3, support: 1 });
      expect(built.total).toBe(4);

      // Multi-product isolation + exact identifier FTS5 search
      const traceHits = searchFactsDb(built.db, '`/i/v1/traces` `$ai_trace_id`', { product: 'tracing' });
      expect(traceHits.length).toBe(1);
      expect(traceHits[0].symbol).toBe('ingest_traces');
      expect(searchFactsDb(built.db, '`/i/v1/traces`', { product: 'support' })).toEqual([]);
      expect(searchFactsDb(built.db, 'vision-scanners-draft 1200', { product: 'tracing' })[0].fact_code).toBe('TR-MCP-F-00003');
      expect(searchFactsDb(built.db, 'isAvailable', { product: 'tracing' })[0].fact_code).toBe('TR-TS-F-00002');

      // Export pass 1: DB -> JSON & YAML
      const outJson1 = join(tmpDir, 'tracing.out1.json');
      const outYaml1 = join(tmpDir, 'support.out1.yml');
      const expA1 = exportFactsToFile(built.db, 'tracing', outJson1);
      const expB1 = exportFactsToFile(built.db, 'support', outYaml1);
      closeAndCleanupFactsDb(built.db, dbPath);

      const expectedSortedA = [...sampleA].sort((a, b) => a.leafKey.localeCompare(b.leafKey));
      expect(expA1.facts).toEqual(expectedSortedA);
      expect(expB1.facts).toEqual(sampleB);

      // Roundtrip pass 2: exported files -> fresh DB -> re-export, verify byte-for-byte identical
      const dbPath2 = join(tmpDir, 'roundtrip2.sqlite');
      const built2 = buildFactsDbFromFiles({
        files: [
          { product: 'tracing', path: outJson1 },
          { product: 'support', path: outYaml1 },
        ],
        dbPath: dbPath2,
        reset: true,
      });
      const outJson2 = join(tmpDir, 'tracing.out2.json');
      const outYaml2 = join(tmpDir, 'support.out2.yml');
      exportFactsToFile(built2.db, 'tracing', outJson2);
      exportFactsToFile(built2.db, 'support', outYaml2);
      closeAndCleanupFactsDb(built2.db, dbPath2, { removeFiles: true });

      expect(readFileSync(outJson2, 'utf8')).toBe(readFileSync(outJson1, 'utf8'));
      expect(readFileSync(outYaml2, 'utf8')).toBe(readFileSync(outYaml1, 'utf8'));
      expect(existsSync(dbPath2)).toBe(false);
      expect(existsSync(`${dbPath2}-wal`)).toBe(false);
      expect(existsSync(`${dbPath2}-shm`)).toBe(false);

      // Verify YAML outline file ingestion (`sections[].refs[]`)
      const outlineYaml = join(tmpDir, 'ch-sample.yml');
      writeFileSync(outlineYaml, yaml.dump({
        key: 'ch-sample',
        title: 'Sample Chapter',
        sections: [{
          key: 'sec-sample',
          refs: [{
            code: 'SV-UI-F-00001',
            surface: 'UI',
            repo: 'posthog',
            path: 'products/surveys/frontend/App.tsx',
            symbol: 'SurveyForm',
            lines: '10-40',
            claim_type: 'behavior',
            claim: 'Renders the survey creation form.',
            quote: 'export function SurveyForm() {',
            pin: 'abc-def',
          }],
        }],
      }));
      const outlineDbPath = join(tmpDir, 'outline.sqlite');
      const builtOutline = buildFactsDbFromFiles({
        files: [{ product: 'surveys', path: outlineYaml }],
        dbPath: outlineDbPath,
        reset: true,
      });
      const exportedOutline = exportFactsFromDb(builtOutline.db, 'surveys');
      expect(exportedOutline).toHaveLength(1);
      expect(exportedOutline[0].factCode).toBe('SV-UI-F-00001');
      expect(exportedOutline[0].sectionKey).toBe('sec-sample');
      closeAndCleanupFactsDb(builtOutline.db, outlineDbPath, { removeFiles: true });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('guarantees setup/teardown hygiene on reset, persisted reopen integrity, and withTempFactsDb error paths', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'facts-hygiene-'));
    try {
      const dbPath = join(tmpDir, 'persisted.sqlite');

      // First build + persist + close (flushes WAL)
      const db1 = openFactsDb(dbPath, { reset: true });
      insertFactsIntoDb(db1, 'tracing', makeSampleFacts());
      closeAndCleanupFactsDb(db1, dbPath, { removeFiles: false });
      expect(existsSync(dbPath)).toBe(true);

      // Reopen persisted DB -> integrity check & FTS5 queries pass
      const dbReopen = openFactsDb(dbPath, { reset: false });
      const integrity = dbReopen.prepare('PRAGMA integrity_check;').get();
      expect(Object.values(integrity)[0]).toBe('ok');
      expect(searchFactsDb(dbReopen, '$ai_trace_id', { product: 'tracing' })).toHaveLength(1);
      closeAndCleanupFactsDb(dbReopen, dbPath, { removeFiles: false });

      // reset: true cleanly replaces prior DB + any sidecars
      const dbReset = openFactsDb(dbPath, { reset: true });
      expect(exportFactsFromDb(dbReset, 'tracing')).toEqual([]);
      closeAndCleanupFactsDb(dbReset, dbPath, { removeFiles: true });
      expect(existsSync(dbPath)).toBe(false);
      expect(existsSync(`${dbPath}-wal`)).toBe(false);
      expect(existsSync(`${dbPath}-shm`)).toBe(false);

      // withTempFactsDb: success path removes temp dir and DB files
      let capturedDir = '';
      let capturedDbPath = '';
      const okRes = await withTempFactsDb(({ db, dbPath: p, tmpDir: d }) => {
        capturedDir = d;
        capturedDbPath = p;
        insertFactsIntoDb(db, 'tracing', makeSampleFacts());
        return exportFactsFromDb(db, 'tracing').length;
      });
      expect(okRes).toBe(3);
      expect(existsSync(capturedDbPath)).toBe(false);
      expect(existsSync(capturedDir)).toBe(false);

      // withTempFactsDb: thrown error still cleans up 100% of files/dirs
      let errDir = '';
      let errDbPath = '';
      await expect(
        withTempFactsDb(({ db, dbPath: p, tmpDir: d }) => {
          errDir = d;
          errDbPath = p;
          insertFactsIntoDb(db, 'tracing', makeSampleFacts());
          throw new Error('intentional boom');
        })
      ).rejects.toThrow('intentional boom');
      expect(existsSync(errDbPath)).toBe(false);
      expect(existsSync(`${errDbPath}-wal`)).toBe(false);
      expect(existsSync(`${errDbPath}-shm`)).toBe(false);
      expect(existsSync(errDir)).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('benchmarks 5,000 facts file -> sqlite -> 20 BM25/exact queries -> file -> teardown within budget', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'facts-bench-'));
    try {
      const N = 5000;
      const surfaces = ['UI', 'API', 'MCP', 'TS', 'PY', 'GO', 'RB'];
      const facts = [];
      for (let i = 0; i < N; i++) {
        const surf = surfaces[i % surfaces.length];
        const isNeedleA = i === 1234;
        const isNeedleB = i === 3456;
        facts.push({
          factCode: `BENCH-${surf}-F-${String(i + 1).padStart(5, '0')}`,
          leafKey: `BENCH|${surf}|posthog:products/bench/mod_${i % 50}.ts#sym_${i}|fact|${String(i).padStart(5, '0')}`,
          def: `posthog:products/bench/mod_${i % 50}.ts#sym_${i}`,
          repo: 'posthog',
          path: `products/bench/mod_${i % 50}.ts`,
          symbol: isNeedleA ? 'vision-scanners-draft' : isNeedleB ? 'isAvailable' : `handleOperation${i}`,
          surface: surf,
          sectionKey: `sec-group-${i % 20}`,
          type: i % 3 === 0 ? 'limit' : 'behavior',
          claim: isNeedleA
            ? 'MCP tool `vision-scanners-draft` captures video frames up to 1200x480 resolution.'
            : isNeedleB
              ? 'Client helper `isAvailable()` returns true when `$ai_trace_id` instrumentation is initialized.'
              : `Operation ${i} validates request quota=${(i % 90) + 10} on route /api/projects/bench/${i % 40}.`,
          quote: isNeedleA
            ? 'const MAX_WIDTH = 1200; // vision-scanners-draft'
            : isNeedleB
              ? 'export function isAvailable(): boolean { return Boolean(traceId); }'
              : `export function handleOperation${i}(limit = ${(i % 90) + 10}) { return limit; }`,
          port: i % 4 === 0 ? { kind: 'http', dir: 'in', key: `/api/projects/bench/${i % 40}` } : null,
          featureFlags: i % 10 === 0 ? [{ flag: `BENCH_FLAG_${i % 5}`, scope: 'subfeature', via: 'direct' }] : [],
          lines: `${(i % 200) + 1}-${(i % 200) + 25}`,
          pin: { commit: '0123456789ab', code_hash: `hash${String(i).padStart(5, '0')}` },
        });
      }

      const t0 = performance.now();
      const inPath = join(tmpDir, 'bench-5000.json');
      writeFileSync(inPath, JSON.stringify(facts));
      const tSetup = performance.now();

      const dbPath = join(tmpDir, 'bench-5000.sqlite');
      const { db, total } = buildFactsDbFromFiles({
        files: [{ product: 'bench', path: inPath }],
        dbPath,
        reset: true,
      });
      const tBuild = performance.now();
      expect(total).toBe(N);

      const queryTexts = [
        'Use `vision-scanners-draft` with 1200px width',
        'Call `isAvailable()` to inspect `$ai_trace_id` status',
        ...Array.from({ length: 18 }, (_, k) => `Route /api/projects/bench/${k} validates quota for handleOperation${k * 200}`),
      ];
      let totalHits = 0;
      for (let q = 0; q < queryTexts.length; q++) {
        const res = queryFactsForPieces(
          db,
          [{ headingPath: `Section ${q}`, text: queryTexts[q], surfaceHint: surfaces[q % surfaces.length] }],
          { product: 'bench', limit: 40 }
        );
        totalHits += res.inProductIndices.length;
        if (q === 0) expect(res.inProductIndices).toContain(1234);
        if (q === 1) expect(res.inProductIndices).toContain(3456);
      }
      const tQuery = performance.now();
      expect(totalHits).toBeGreaterThan(20);

      const outPath = join(tmpDir, 'bench-5000.out.json');
      const exp = exportFactsToFile(db, 'bench', outPath);
      const tExport = performance.now();
      expect(exp.count).toBe(N);

      closeAndCleanupFactsDb(db, dbPath, { removeFiles: true });
      const tTeardown = performance.now();

      const setupMs = +(tSetup - t0).toFixed(1);
      const buildMs = +(tBuild - tSetup).toFixed(1);
      const queryMs = +(tQuery - tBuild).toFixed(1);
      const exportMs = +(tExport - tQuery).toFixed(1);
      const teardownMs = +(tTeardown - tExport).toFixed(1);
      const totalPipelineMs = +(tTeardown - tSetup).toFixed(1);

      console.log(
        `[facts-sqlite benchmark 5,000 facts] writeInput=${setupMs}ms | buildDb+FTS5=${buildMs}ms | 20queries=${queryMs}ms (${(queryMs / 20).toFixed(2)}ms/q) | exportFile=${exportMs}ms | teardown=${teardownMs}ms | total(build->teardown)=${totalPipelineMs}ms`
      );
      expect(totalPipelineMs).toBeLessThan(2000);
      expect(existsSync(dbPath)).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
