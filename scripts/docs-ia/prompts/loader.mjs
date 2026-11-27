// Composable prompt loader with shared fragment includes (`{{include:shared/foo.md}}`)
// and strict `{{variable}}` interpolation. Fails loudly on missing partials or unresolved vars.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROMPTS_DIR = dirname(fileURLToPath(import.meta.url));

const INCLUDE_RE = /\{\{include:([a-zA-Z0-9_./-]+)\}\}/g;
const VAR_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

function expandIncludes(template, promptsDir, seen = new Set()) {
  return template.replace(INCLUDE_RE, (_match, relPath) => {
    const absPath = resolve(promptsDir, relPath);
    if (!absPath.startsWith(resolve(promptsDir))) {
      throw new Error(`Prompt include escapes prompts directory: ${relPath}`);
    }
    if (!existsSync(absPath)) {
      throw new Error(`Missing shared prompt partial: ${relPath}`);
    }
    if (seen.has(absPath)) {
      throw new Error(`Circular prompt include detected: ${relPath}`);
    }
    const nextSeen = new Set(seen);
    nextSeen.add(absPath);
    const body = readFileSync(absPath, 'utf8').trim();
    return expandIncludes(body, promptsDir, nextSeen);
  });
}

/**
 * Load a workflow step prompt, inline all `{{include:...}}` shared fragments,
 * and interpolate every `{{var}}`.
 */
export function renderPrompt(promptName, vars = {}, { promptsDir = PROMPTS_DIR, allowMissingVars = false } = {}) {
  const fullPath = join(promptsDir, promptName);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing prompt file: ${promptName}`);
  }
  const raw = readFileSync(fullPath, 'utf8');
  const expanded = expandIncludes(raw, promptsDir);
  const missing = [];
  const rendered = expanded.replace(VAR_RE, (match, key) => {
    if (Object.hasOwn(vars, key) && vars[key] !== undefined && vars[key] !== null) {
      return String(vars[key]);
    }
    missing.push(key);
    return match;
  });
  if (missing.length && !allowMissingVars) {
    throw new Error(`Prompt "${promptName}" has unresolved placeholders: ${[...new Set(missing)].join(', ')}`);
  }
  return rendered;
}

/** Return the list of `{{include:...}}` partials and `{{var}}` placeholders a prompt requires. */
export function inspectPrompt(promptName, { promptsDir = PROMPTS_DIR } = {}) {
  const fullPath = join(promptsDir, promptName);
  const raw = readFileSync(fullPath, 'utf8');
  const includes = [...raw.matchAll(INCLUDE_RE)].map(m => m[1]);
  const expanded = expandIncludes(raw, promptsDir);
  const variables = [...new Set([...expanded.matchAll(VAR_RE)].map(m => m[1]))];
  return { promptName, includes, variables };
}
