import { describe, expect, it } from 'vitest';
import { nextClaimState, nextFactState } from '../models/claim.mjs';
import { isConnectCandidate, normalizePortKey, stableFactKey, validateFact } from '../models/fact.mjs';
import { compactLineRuns, createDetachedPin, expandLineRuns, refreshDetachedPin } from '../models/pin.mjs';
import { assignDeweyCodesV3, auditTrailForCode } from '../models/register.mjs';

describe('models/pin (detached two-gate refresh)', () => {
  it('skips file reads and hashing when commit matches HEAD (outer gate)', () => {
    let reads = 0;
    const pin = createDetachedPin({ commit: 'aaa111', text: 'def foo():\n    return 1', ownLines: [10, 11] });
    const res = refreshDetachedPin({
      pin,
      headCommit: 'aaa111',
      getSliceText: () => { reads++; return 'def foo():\n    return 1'; },
    });
    expect(res.state).toBe('fresh');
    expect(res.hashChecked).toBe(false);
    expect(res.bumped).toBe(false);
    expect(res.llmCalls).toBe(0);
    expect(reads).toBe(0);
  });

  it('bumps commit at 0 LLM calls when commit moved but function body MD5 is unchanged (inner gate)', () => {
    const body = 'def foo():\n    return 42';
    const pin = createDetachedPin({ commit: 'aaa111', text: body, ownLines: [5, 6, 7, 12, 13] });
    expect(pin.own_runs).toEqual([[5, 7], [12, 13]]);
    expect(expandLineRuns(pin.own_runs)).toEqual([5, 6, 7, 12, 13]);

    const res = refreshDetachedPin({
      pin,
      headCommit: 'bbb222',
      getSliceText: () => body,
    });
    expect(res.state).toBe('fresh');
    expect(res.hashChecked).toBe(true);
    expect(res.bumped).toBe(true);
    expect(res.pin.commit).toBe('bbb222');
    expect(res.pin.code_hash).toBe(pin.code_hash);
    expect(res.llmCalls).toBe(0);
  });

  it('flags recheck vs stale vs gone when body changes or disappears', () => {
    const pin = createDetachedPin({
      commit: 'aaa111',
      text: 'const limit = 100;\nreturn sendSurvey();',
      quote: 'const limit = 100;',
    });
    const recheck = refreshDetachedPin({
      pin,
      headCommit: 'bbb222',
      getSliceText: () => 'const limit = 100;\nreturn sendSurveyV2();',
    });
    expect(recheck.state).toBe('recheck');

    const stale = refreshDetachedPin({
      pin,
      headCommit: 'ccc333',
      getSliceText: () => 'const limit = 500;\nreturn sendSurveyV2();',
    });
    expect(stale.state).toBe('stale');

    const gone = refreshDetachedPin({
      pin,
      headCommit: 'ddd444',
      getSliceText: () => null,
    });
    expect(gone.state).toBe('gone');
  });
});

describe('models/fact (anti-bloat, quarantine, stable keys)', () => {
  it('enforces verbatim quotes, anti-bloat, ports, and source quarantine', () => {
    const slice = 'if limit > 100:\n    raise ValidationError("max 100 items")';
    expect(validateFact({
      type: 'limit',
      claim: 'Requests reject payloads with more than 100 items.',
      quote: 'raise ValidationError("max 100 items")',
    }, slice)).toBeNull();

    expect(validateFact({
      type: 'limit',
      claim: 'Requests reject payloads with more than 100 items.',
      quote: 'not in slice at all',
    }, slice)).toMatch(/exact substring/);

    expect(validateFact({
      type: 'control',
      claim: 'Clicking the button submits the survey form.',
      quote: 'onClick={onClick}',
    }, 'onClick={onClick}')).toMatch(/generic 1-token/);

    expect(validateFact({
      type: 'fact',
      path: 'contents/docs/surveys/creating-surveys.mdx',
      claim: 'Docs cannot pin runtime facts against docs pages.',
      quote: 'raise ValidationError("max 100 items")',
    }, slice)).toMatch(/circular/);
  });

  it('keeps stableFactKey identical across commit bumps and normalizes HTTP ports', () => {
    const k1 = stableFactKey({ surface: 'API', defId: 'posthog:a.py#Foo', factType: 'limit', quote: 'LIMIT   100' });
    const k2 = stableFactKey({ surface: 'api', defId: 'posthog:a.py#Foo', factType: 'limit', quote: 'LIMIT 100' });
    expect(k1).toBe(k2);
    expect(normalizePortKey('http', 'POST /api/projects/${team_id}/surveys/')).toBe('post /api/projects/{}/surveys');
    expect(isConnectCandidate({ type: 'storage', claim: 'Writes hypercache', quote: 'update_cache()' })).toBe(true);
  });
});

describe('models/claim & models/register (state machines + Dewey v3 audit trail)', () => {
  it('enforces legal claim and fact state transitions', () => {
    expect(nextClaimState('fresh', 'pin_changed')).toBe('stale');
    expect(nextClaimState('stale', 'judge_contradicted')).toBe('contradicted');
    expect(nextClaimState('fresh', 'human_edit')).toBe('unverified_human');
    expect(() => nextClaimState('structural', 'contradict')).toThrow(/Illegal claim transition/);
    expect(nextFactState('recheck', 'judge_no_change')).toBe('fresh');
  });

  it('relocates moved facts by quote signature, preserves v2 codes, and traces retired audit trails', () => {
    const first = assignDeweyCodesV3({
      productCode: 'MCPA',
      surfaces: ['API', 'MCP', 'TS'],
      outline: [{ key: 'ch-capture', title: 'Capture', sections: [{ key: 'sec-tools', title: 'Tools' }] }],
      leaves: [
        {
          kind: 'F',
          surface: 'MCP',
          key: 'f3:mcp:posthog:old.py#list_tools:fact:abc',
          title: 'Lists registered MCP tools',
          quote: 'def list_mcp_tools(team_id):',
        },
      ],
      today: '2026-11-01',
    });
    expect(first.leaves[0].code).toBe('MCPA-MCP-F-000001');

    // File split / symbol rename with identical quote -> preserves code MCPA-MCP-F-000001
    const second = assignDeweyCodesV3({
      productCode: 'MCPA',
      surfaces: ['API', 'MCP', 'TS'],
      outline: [{ key: 'ch-capture', title: 'Capture', sections: [{ key: 'sec-tools', title: 'Tools' }] }],
      leaves: [
        {
          kind: 'F',
          surface: 'MCP',
          key: 'f3:mcp:posthog:new_module.py#list_tools:fact:abc',
          title: 'Lists registered MCP tools',
          quote: 'def list_mcp_tools(team_id):',
        },
      ],
      register: first.register,
      ucRegister: first.ucRegister,
      today: '2026-11-10',
    });
    expect(second.leaves[0].code).toBe('MCPA-MCP-F-000001');
    expect(second.stats.relocated).toBe(1);
    expect(second.stats.minted).toBe(0);

    // Explicit rename retirement -> forward pointer audit trail works beyond git blame
    const third = assignDeweyCodesV3({
      productCode: 'MCPA',
      surfaces: ['API', 'MCP', 'TS'],
      outline: [{ key: 'ch-capture', title: 'Capture', sections: [{ key: 'sec-tools', title: 'Tools' }] }],
      leaves: [
        {
          kind: 'F',
          surface: 'MCP',
          key: 'f3:mcp:posthog:v2.py#list_tools_v2:fact:xyz',
          title: 'Lists v2 MCP tools',
          quote: 'def list_mcp_tools_v2(project_id):',
        },
      ],
      register: second.register,
      ucRegister: second.ucRegister,
      leafChanges: [{
        retire: ['MCPA-MCP-F-000001'],
        op: 'rename',
        to: ['MCPA-MCP-F-000002'],
        reason: 'Migrated team_id endpoint to project_id v2',
      }],
      today: '2026-11-20',
    });
    expect(third.leaves[0].code).toBe('MCPA-MCP-F-000002');
    const trail = auditTrailForCode(third.register, 'MCPA-MCP-F-000001');
    expect(trail.status).toBe('forwarded');
    expect(trail.liveTargets).toEqual(['MCPA-MCP-F-000002']);
    expect(trail.hops[0].reason).toMatch(/project_id v2/);
  });
});
