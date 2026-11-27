// Surface-sliced (or full) UC-* one-pager skill compiler + internal anchor verifier.

const ANCHOR_ID_RE = /<a id="([^"]+)"><\/a>/g;
const INTERNAL_LINK_RE = /\]\(#([^)]+)\)/g;

function slugAnchor(code) {
  return `fact-${String(code).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`;
}

/**
 * Compile one use case (`UC-*`) into a standalone Markdown skill containing inline prerequisites,
 * surface-filtered procedures, and resolved code-pinned facts with verified internal anchor links.
 */
export function compileUseCaseSkill({
  useCase,
  procedures = [],
  facts = [],
  prerequisites = [],
  surfaces = null,
}) {
  const surfFilter = Array.isArray(surfaces) && surfaces.length
    ? new Set(surfaces.map(s => s.toUpperCase()))
    : null;

  const procByCode = new Map(procedures.map(p => [p.code || p.id, p]));
  const factByCode = new Map(facts.map(f => [f.code || f.id, f]));

  const selectedProcs = (useCase.procedures || [])
    .map(pid => procByCode.get(pid))
    .filter(Boolean)
    .filter(p => !surfFilter || surfFilter.has(String(p.surface || '').toUpperCase()));

  const citedFactCodes = new Set();
  for (const pr of selectedProcs) {
    for (const step of pr.steps || []) {
      for (const fid of step.facts || []) {
        if (factByCode.has(fid)) citedFactCodes.add(fid);
      }
    }
  }
  const resolvedFacts = [...citedFactCodes].map(code => factByCode.get(code));
  const selectedPrereqs = prerequisites.filter(
    p => !surfFilter || !p.surface || surfFilter.has(String(p.surface).toUpperCase())
  );

  const lines = [
    '---',
    `id: ${useCase.code || useCase.id}`,
    `title: ${JSON.stringify(useCase.title || useCase.key || useCase.code)}`,
    `surfaces: [${[...new Set(selectedProcs.map(p => p.surface).filter(Boolean))].join(', ')}]`,
    `procedures: ${selectedProcs.length}`,
    `resolved_facts: ${resolvedFacts.length}`,
    '---',
    '',
    `# ${useCase.code || useCase.id}: ${useCase.title || useCase.key}`,
    '',
  ];

  if (selectedPrereqs.length) {
    lines.push('## Prerequisites', '');
    for (const p of selectedPrereqs) {
      lines.push(`- **${p.code || p.id}** (${p.surface || 'ALL'}): ${p.claim || p.title}`);
    }
    lines.push('');
  }

  lines.push('## Procedures', '');
  for (const pr of selectedProcs) {
    lines.push(`### ${pr.code || pr.id} (${pr.surface || 'ALL'}): ${pr.goal || pr.title}`, '');
    (pr.steps || []).forEach((st, idx) => {
      const refs = (st.facts || [])
        .filter(fid => factByCode.has(fid))
        .map(fid => `[\`${fid}\`](#${slugAnchor(fid)})`)
        .join(', ');
      const seam = st.platform_seam ? ` _(stops at seam \`${st.platform_seam}\`)_` : '';
      lines.push(`${idx + 1}. ${st.text}${refs ? ` (${refs})` : ''}${seam}`);
    });
    lines.push('');
  }

  lines.push('## Resolved facts (code-pinned)', '');
  for (const f of resolvedFacts) {
    const code = f.code || f.id;
    const pinStr = f.pin?.commit && f.pin?.code_hash
      ? `${f.pin.commit.slice(0, 8)}-${f.pin.code_hash.slice(0, 8)}`
      : (typeof f.pin === 'string' ? f.pin : 'unpinned');
    lines.push(`<a id="${slugAnchor(code)}"></a>`);
    lines.push(`- **${code}** \`${f.type}\` (\`${f.def}\` @ \`${pinStr}\`): ${f.claim}`);
    if (f.quote) lines.push(`  - Quote: \`${f.quote}\``);
  }
  lines.push('');

  const markdown = lines.join('\n');
  return {
    code: useCase.code || useCase.id,
    markdown,
    stats: {
      bytes: Buffer.byteLength(markdown, 'utf8'),
      lines: lines.length,
      procedures: selectedProcs.length,
      resolvedFacts: resolvedFacts.length,
    },
  };
}

/** Verify that every internal `#anchor` link in a compiled skill resolves to a declared `<a id="...">`. */
export function verifySkillAnchors(markdown) {
  const declared = new Set([...markdown.matchAll(ANCHOR_ID_RE)].map(m => m[1]));
  const refs = [...markdown.matchAll(INTERNAL_LINK_RE)].map(m => m[1]);
  const broken = refs.filter(r => !declared.has(r));
  return {
    totalLinks: refs.length,
    declaredAnchors: declared.size,
    brokenLinks: broken,
    ok: broken.length === 0,
  };
}
