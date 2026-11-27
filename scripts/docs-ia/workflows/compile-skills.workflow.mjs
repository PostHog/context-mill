// Workflow 4: Compile Lean, Ugly Agent Skills (RFC "Downstream: lean, ugly agent skills").
//
// Top-level execution order:
//   1. [script] compile-uc-skills -> Compile each UC-* (optionally sliced by surface) with inline prereqs & facts
//   2. [script] verify-anchors    -> Verify 0 broken internal `#fact-*` anchor links across every compiled file
import { defineWorkflow, scriptStep } from '../models/workflow.mjs';
import { compileUseCaseSkill, verifySkillAnchors } from '../tools/skill-compiler.mjs';

function runCompileUcSkills(ctx) {
  const compiled = (ctx.state.useCases || []).map(uc =>
    compileUseCaseSkill({
      useCase: uc,
      procedures: ctx.state.procedures || [],
      facts: ctx.state.facts || [],
      prerequisites: ctx.state.prerequisites || [],
      surfaces: ctx.state.skillSurfaces || null,
    })
  );
  ctx.state.compiledSkills = compiled;
  return {
    skillsCompiled: compiled.length,
    totalBytes: compiled.reduce((acc, s) => acc + s.stats.bytes, 0),
  };
}

function runVerifyAnchors(ctx) {
  const reports = (ctx.state.compiledSkills || []).map(s => ({
    code: s.code,
    ...verifySkillAnchors(s.markdown),
  }));
  const brokenCount = reports.reduce((acc, r) => acc + r.brokenLinks.length, 0);
  ctx.state.anchorVerification = { reports, brokenCount, ok: brokenCount === 0 };
  if (brokenCount > 0) {
    throw new Error(`Compiled skills contain ${brokenCount} broken internal anchor links`);
  }
  return {
    skillsVerified: reports.length,
    totalLinks: reports.reduce((acc, r) => acc + r.totalLinks, 0),
    brokenLinks: 0,
  };
}

export const compileSkillsWorkflow = defineWorkflow({
  id: 'compile-skills',
  title: 'Compile Downstream Agent Skills',
  description: 'Compile surface-sliced or full UC-* one-pager Markdown skills directly from derived knowledge and verify every internal anchor link.',
  rfcSection: 'Downstream: lean, ugly agent skills',
  steps: [
    scriptStep({
      id: 'compile-uc-skills',
      description: 'Render standalone UC-* skills with inline prerequisites, procedures, and resolved facts (0 LLM)',
      run: runCompileUcSkills,
    }),
    scriptStep({
      id: 'verify-anchors',
      description: 'Verify every internal #fact-* anchor link resolves with 0 broken links (0 LLM)',
      run: runVerifyAnchors,
    }),
  ],
});
