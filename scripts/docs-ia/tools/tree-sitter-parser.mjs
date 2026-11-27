// Pluggable Tree-sitter AST declaration & member-folding adapter (`parseAst` hook for `ast-pins.mjs`).
//
// Ports the `declarationIndex` AST scope walker + grammar-gap patcher (TS/TSX, Python, Rust, Swift,
// Kotlin, Dart) and `foldMembers` definition-grain folder so `build-ia`, `refresh-drift`, and
// `replay-prs` compute exact disjoint `ownLines` slices.
//
// Zero-dep safe: dynamically resolves `web-tree-sitter` + `tree-sitter-wasms` when installed or
// configured via `moduleSearchPaths` / `DOCS_IA_TREESITTER_NODE_MODULES`. When absent (e.g. CI unit
// tests), `createTreeSitterAstParser()` returns `{ available: false, parseAst: null }` so
// `indexSourceFile` falls back to its built-in deterministic declaration extractor.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MODULE_SYMBOL } from './ast-pins.mjs';

export const SUPPORTED_GRAMMARS = Object.freeze({
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'c_sharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.dart': 'dart',
});

const STANDALONE_MEMBER_LINES = 20;
const STANDALONE_CALLABLE_LINES = 6;
const IDENTIFIERS = new Set([
  'identifier',
  'simple_identifier',
  'type_identifier',
  'property_identifier',
  'field_identifier',
]);

export function supportedTreeSitterExt(ext) {
  return Object.hasOwn(SUPPORTED_GRAMMARS, String(ext || '').toLowerCase());
}

export function isCallableKind(kind, relPath = '') {
  const dart = String(relPath).endsWith('.dart');
  return String(kind || '')
    .split('+')
    .some(k => /function|method|constructor|init_declaration/.test(k) && !/protocol/.test(k) && (dart || !/signature/.test(k)));
}

function* ancestors(nodes, n) {
  const parts = n.symbol.split('.');
  for (let k = parts.length - 1; k >= 1; k--) {
    const a = nodes.get(`${n.repo}:${n.path}#${parts.slice(0, k).join('.')}`);
    if (a) yield a;
  }
}

function isStandaloneNode(n) {
  if (n.symbol === MODULE_SYMBOL || !n.symbol.includes('.')) return true;
  const threshold = isCallableKind(n.kind, n.path) ? STANDALONE_CALLABLE_LINES : STANDALONE_MEMBER_LINES;
  return (n.ownLines?.length ?? 0) >= threshold;
}

/**
 * Fold raw AST declarations into standalone definitions: nested fields, enum members, and short
 * accessors fold into their nearest standalone holder so `ownLines` remain disjoint and stable.
 */
export function foldMembers(nodes) {
  const holderOf = new Map();
  for (const n of nodes.values()) {
    if (isStandaloneNode(n)) {
      holderOf.set(n.id, n.id);
      continue;
    }
    let holder = null;
    for (const a of ancestors(nodes, n)) {
      if (isStandaloneNode(a)) {
        holder = a.id;
        break;
      }
    }
    holderOf.set(n.id, holder ?? `${n.repo}:${n.path}#${MODULE_SYMBOL}`);
  }

  const defs = new Map();
  const lineSets = new Map();
  for (const n of nodes.values()) {
    const h = holderOf.get(n.id);
    if (!defs.has(h)) {
      const base = nodes.get(h) ?? {
        repo: n.repo,
        path: n.path,
        symbol: MODULE_SYMBOL,
        kind: 'module',
        inScope: n.inScope,
        ownLines: [],
      };
      defs.set(h, {
        id: h,
        repo: base.repo,
        path: base.path,
        symbol: base.symbol,
        kind: base.kind,
        inScope: Boolean(base.inScope),
        start: base.lines?.[0] ?? base.ownLines?.[0] ?? 1,
        end: base.lines?.[1] ?? null,
        members: 0,
      });
      lineSets.set(h, new Set());
    }
    for (const l of n.ownLines ?? []) lineSets.get(h).add(l);
    if (h !== n.id) defs.get(h).members++;
  }
  for (const d of defs.values()) {
    d.ownLines = [...lineSets.get(d.id)].sort((a, b) => a - b);
    d.lines = d.ownLines.length;
  }
  return { holderOf, defs };
}

/**
 * Same-length source patch for grammar lexer quirks (TSX bare `&` in JSX strings/text, Kotlin trailing commas).
 */
export function patchGrammarGaps(source, language) {
  const bareAmpersand = text => text.replace(/&(?!(?:#[0-9]{1,5}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z]{1,30});)/g, '_');
  if (language === 'tsx') {
    return source
      .replace(/(=\s*)("[^"\n]*"|'[^'\n]*')/g, (_all, eq, value) => eq + bareAmpersand(value))
      .replace(/>([^<>{}\n]*&[^<>{}\n]*)(?=<)/g, (_all, text) => '>' + bareAmpersand(text));
  }
  if (language === 'kotlin') return source.replace(/,(\s*\)\s*->)/g, ' $1');
  return source;
}

const isComment = node => /comment/.test(node.type);

function firstDescendant(node, types) {
  if (!node) return undefined;
  if (types.has(node.type)) return node;
  for (const child of node.namedChildren || []) {
    const found = firstDescendant(child, types);
    if (found) return found;
  }
  return undefined;
}

function unquoteLiteral(node) {
  const raw = String(node?.text ?? '');
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return null;
}

function nameOf(node) {
  const named = node.childForFieldName?.('name');
  if (named) {
    if (named.type === 'computed_property_name') {
      const expr = named.namedChildren?.[0];
      const lit = expr && unquoteLiteral(expr);
      return lit ?? (expr?.type === 'number' ? expr.text : undefined);
    }
    if (['string', 'number'].includes(named.type)) return unquoteLiteral(named) ?? named.text;
    if (IDENTIFIERS.has(named.type) || named.type === 'user_type') return named.text;
    return firstDescendant(named, IDENTIFIERS)?.text;
  }
  return (node.namedChildren || []).find(child => IDENTIFIERS.has(child.type))?.text;
}

function unitBounds(node, language) {
  let first = node;
  let last = node;
  if (language === 'python' && node.parent?.type === 'decorated_definition') first = last = node.parent;
  if (language === 'typescript' || language === 'tsx') {
    for (
      let prev = node.previousNamedSibling;
      prev && (prev.type === 'decorator' || isComment(prev));
      prev = prev.previousNamedSibling
    ) {
      if (prev.type === 'decorator') first = prev;
    }
    if (node.parent?.type === 'export_statement') first = last = node.parent;
    if (
      node.type === 'variable_declarator' &&
      ['lexical_declaration', 'variable_declaration'].includes(node.parent?.type) &&
      node.parent.namedChildren.filter(n => n.type === 'variable_declarator').length === 1
    ) {
      first = last = node.parent;
      if (first.parent?.type === 'export_statement') first = last = first.parent;
    }
  }
  if (language === 'dart') {
    const body = node.nextNamedSibling;
    if (body?.type === 'function_body') last = body;
  }
  if (language === 'rust') {
    for (
      let prev = node.previousNamedSibling;
      prev && (prev.type === 'attribute_item' || isComment(prev));
      prev = prev.previousNamedSibling
    ) {
      if (prev.type === 'attribute_item') first = prev;
    }
  }
  return { first, last };
}

function rustTypePath(node) {
  if (!node) return [];
  if (node.type === 'generic_type' || node.type === 'reference_type') return rustTypePath(node.childForFieldName('type'));
  if (['scoped_type_identifier', 'scoped_identifier'].includes(node.type)) {
    return [...rustTypePath(node.childForFieldName('path')), ...rustTypePath(node.childForFieldName('name'))];
  }
  return ['type_identifier', 'identifier', 'crate', 'self', 'super'].includes(node.type) ? [node.text] : [];
}

function classifyNodeDeclaration(node, language, scopes) {
  const type = node.type;
  if (language === 'typescript' || language === 'tsx') {
    if (['class_declaration', 'abstract_class_declaration', 'internal_module'].includes(type)) {
      return { name: nameOf(node), scope: true, kind: 'class' };
    }
    if (type === 'enum_declaration') {
      return { name: nameOf(node), scope: true, kind: 'enum' };
    }
    if (type === 'interface_declaration') {
      return { name: nameOf(node), scope: true, kind: 'interface' };
    }
    if (type === 'type_alias_declaration') {
      const obj = node.childForFieldName('value');
      return { name: nameOf(node), scope: obj?.type === 'object_type', kind: 'type_alias', objectNode: obj?.type === 'object_type' ? obj : undefined };
    }
    if (type === 'variable_declarator') {
      for (let p = node.parent; p; p = p.parent) {
        if (['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'class_body'].includes(p.type)) return null;
      }
      const val = node.childForFieldName('value');
      return { name: nameOf(node), scope: val?.type === 'object', kind: 'object', objectNode: val?.type === 'object' ? val : undefined };
    }
    if (['function_declaration', 'function_signature'].includes(type)) return { name: nameOf(node), scope: true, kind: 'function' };
    if (['method_definition', 'abstract_method_signature', 'method_signature', 'public_field_definition', 'property_signature'].includes(type)) {
      const parent = node.parent;
      const scope = scopes.at(-1);
      const okParent = ['class_body', 'interface_body'].includes(parent?.type) ||
        (['object', 'object_type'].includes(parent?.type) && scope?.objectNode?.id === parent.id);
      if (!okParent) return null;
      return { name: nameOf(node), scope: type === 'method_definition', kind: type === 'method_definition' ? 'function' : 'member' };
    }
    if (type === 'pair' && node.parent?.type === 'object' && scopes.at(-1)?.objectNode?.id === node.parent.id) {
      const key = node.childForFieldName('key');
      const val = node.childForFieldName('value');
      const name = key && (IDENTIFIERS.has(key.type) ? key.text : unquoteLiteral(key));
      return { name, scope: val?.type === 'object', kind: 'object', objectNode: val?.type === 'object' ? val : undefined };
    }
    if (type === 'enum_assignment') return { name: nameOf(node), kind: 'member' };
    if (type === 'property_identifier' && node.parent?.type === 'enum_body') return { name: node.text, kind: 'member' };
    return null;
  }

  if (language === 'python') {
    if (type === 'class_definition') return { name: nameOf(node), scope: true, kind: 'class' };
    if (type === 'function_definition') return { name: nameOf(node), scope: true, kind: 'function' };
    if (type === 'assignment' && !scopes.some(s => s.kind === 'function')) {
      const left = node.childForFieldName('left');
      if (left?.type === 'identifier') return { name: left.text, kind: 'member' };
    }
    return null;
  }

  if (language === 'rust') {
    if (['struct_item', 'trait_item'].includes(type)) {
      return { name: nameOf(node), scope: true, kind: 'class' };
    }
    if (type === 'enum_item') {
      return { name: nameOf(node), scope: true, kind: 'enum' };
    }
    if (type === 'type_item') {
      return { name: nameOf(node), scope: false, kind: 'type_alias' };
    }
    if (type === 'impl_item') {
      const rustPath = rustTypePath(node.childForFieldName('type'));
      return { name: rustPath.at(-1), rustPath, scope: true, kind: 'class' };
    }
    if (['function_item', 'function_signature_item'].includes(type)) return { name: nameOf(node), scope: true, kind: 'function' };
    if (['field_declaration', 'enum_variant', 'const_item'].includes(type)) return { name: nameOf(node), kind: 'member' };
    if (type === 'mod_item') return { name: nameOf(node), scope: true, kind: 'module', hidden: true };
    return null;
  }

  if (language === 'go') {
    if (type === 'function_declaration') return { name: nameOf(node), scope: true, kind: 'function' };
    if (type === 'method_declaration') {
      const recv = node.childForFieldName('receiver');
      const recvType = firstDescendant(recv, new Set(['type_identifier']))?.text;
      const nm = nameOf(node);
      return nm ? { name: recvType ? `${recvType}.${nm}` : nm, scope: true, kind: 'function' } : null;
    }
    if (type === 'type_spec') return { name: nameOf(node), scope: true, kind: 'class' };
    if (type === 'const_spec' && !scopes.some(s => s.kind === 'function')) {
      return { name: nameOf(node), kind: 'member' };
    }
    return null;
  }

  if (language === 'ruby') {
    if (type === 'class' || type === 'module') {
      const cname = node.childForFieldName('name')?.text;
      return cname ? { name: cname, scope: true, kind: 'class' } : null;
    }
    if (type === 'method' || type === 'singleton_method') {
      const nm = node.childForFieldName('name')?.text;
      return nm ? { name: nm, scope: true, kind: 'function' } : null;
    }
    if (type === 'assignment' && !scopes.some(s => s.kind === 'function')) {
      const left = node.childForFieldName('left');
      if (left?.type === 'constant') return { name: left.text, kind: 'member' };
    }
    return null;
  }

  if (language === 'php') {
    if (['class_declaration', 'interface_declaration', 'trait_declaration', 'enum_declaration'].includes(type)) {
      return { name: nameOf(node), scope: true, kind: type === 'interface_declaration' ? 'interface' : 'class' };
    }
    if (['method_declaration', 'function_definition'].includes(type)) return { name: nameOf(node), scope: true, kind: 'function' };
    return null;
  }

  if (language === 'c_sharp') {
    if (['class_declaration', 'struct_declaration', 'record_declaration', 'enum_declaration'].includes(type)) {
      return { name: nameOf(node), scope: true, kind: 'class' };
    }
    if (type === 'interface_declaration') return { name: nameOf(node), scope: true, kind: 'interface' };
    if (['method_declaration', 'constructor_declaration'].includes(type)) return { name: nameOf(node), scope: true, kind: 'function' };
    if (type === 'property_declaration') return { name: nameOf(node), kind: 'member' };
    return null;
  }

  if (language === 'swift') {
    if (type === 'typealias_declaration') return { name: nameOf(node), kind: 'type' };
    if (['class_declaration', 'struct_declaration', 'enum_declaration', 'protocol_declaration', 'extension_declaration'].includes(type)) {
      return { name: nameOf(node), scope: true, kind: 'type' };
    }
    if (['function_declaration', 'protocol_function_declaration'].includes(type)) return { name: nameOf(node), scope: true, kind: 'function' };
    if (type === 'init_declaration') return { name: 'init', scope: true, kind: 'function' };
    if (['property_declaration', 'protocol_property_declaration'].includes(type) && !scopes.some(s => s.kind === 'function')) {
      return { name: firstDescendant(node.childForFieldName('name'), new Set(['simple_identifier']))?.text, kind: 'member' };
    }
    if (type === 'enum_entry') return { name: nameOf(node), kind: 'member' };
    return null;
  }

  if (language === 'kotlin') {
    if (type === 'type_alias') return { name: nameOf(node), kind: 'type' };
    if (['class_declaration', 'object_declaration'].includes(type)) return { name: nameOf(node), scope: true, kind: 'type' };
    if (type === 'companion_object') return { name: nameOf(node) ?? 'Companion', scope: true, kind: 'type' };
    if (type === 'function_declaration') return { name: nameOf(node), scope: true, kind: 'function' };
    if (type === 'secondary_constructor') return { name: 'constructor', scope: true, kind: 'function' };
    if (type === 'property_declaration' && !scopes.some(s => s.kind === 'function')) {
      const v = node.namedChildren.find(c => c.type === 'variable_declaration');
      return { name: v && firstDescendant(v, new Set(['simple_identifier']))?.text, kind: 'member' };
    }
    if (type === 'enum_entry') return { name: nameOf(node), kind: 'member' };
    return null;
  }

  if (language === 'dart') {
    if (type === 'type_alias') return { name: nameOf(node), kind: 'type' };
    if (['class_definition', 'mixin_declaration', 'extension_declaration', 'enum_declaration'].includes(type)) {
      return { name: nameOf(node), scope: true, kind: 'type' };
    }
    if (type === 'method_signature') {
      const sig = node.namedChildren.find(c => /signature$/.test(c.type));
      if (!sig) return null;
      const names = sig.namedChildren.filter(c => c.type === 'identifier');
      return { name: /constructor_signature$/.test(sig.type) ? names.at(-1)?.text : nameOf(sig), kind: 'function' };
    }
    if (type === 'function_signature' && node.parent?.type === 'program') return { name: nameOf(node), kind: 'function' };
    if (type === 'enum_constant') return { name: nameOf(node), kind: 'member' };
  }

  return null;
}

export function indexTreeSitterDeclarations(root, language) {
  const declarations = [];
  function visit(node, scopes) {
    if (isComment(node)) return;
    const candidate = classifyNodeDeclaration(node, language, scopes);
    let nested = scopes;
    if (candidate?.name) {
      let prefix = scopes.at(-1)?.symbol ?? '';
      const segments = [...(candidate.rustPath ?? [candidate.name])];
      if (candidate.rustPath) {
        if (segments[0] === 'crate') { prefix = ''; segments.shift(); }
        else if (segments[0] === 'self') { prefix = scopes.filter(s => s.kind === 'module').at(-1)?.symbol ?? ''; segments.shift(); }
        else if (segments[0] === 'super') {
          prefix = scopes.filter(s => s.kind === 'module').at(-1)?.symbol ?? '';
          while (segments[0] === 'super') { prefix = prefix.split('.').slice(0, -1).join('.'); segments.shift(); }
        }
      }
      const record = {
        ...candidate,
        node,
        ...unitBounds(node, language),
        symbol: [prefix, ...segments].filter(Boolean).join('.'),
      };
      if (!candidate.hidden) declarations.push(record);
      if (candidate.scope) nested = [...scopes, record];
    }
    for (const child of node.namedChildren || []) visit(child, nested);
  }
  visit(root, []);
  return declarations;
}

function errorCount(root) {
  let count = 0;
  (function visit(node) {
    if (!node.hasError && !node.isMissing) return;
    if (node.isError || node.isMissing) count++;
    for (const child of node.children || []) visit(child);
  })(root);
  return count;
}

/**
 * Convert raw `{ symbol, kind, first, last }` declaration bounds into folded standalone `{ symbol, kind, ownLines }` definitions.
 */
export function foldRawDeclarationsToDefs({ repo, path: relPath, lines, declarations }) {
  const sorted = [...declarations].sort(
    (a, b) => (a.last.endIndex - a.first.startIndex) - (b.last.endIndex - b.first.startIndex)
  );
  const claimedLine = new Map();
  const nodes = new Map();

  for (const d of sorted) {
    const startRow = d.first.startPosition.row + 1;
    const endPos = d.last.endPosition;
    const endRow = endPos.row + (endPos.column === 0 && endPos.row > d.first.startPosition.row ? 0 : 1);
    const id = `${repo}:${relPath}#${d.symbol}`;
    const own = [];
    for (let ln = startRow; ln <= endRow; ln++) {
      if ((lines[ln - 1] ?? '').trim() === '') continue;
      if (!claimedLine.has(ln)) {
        claimedLine.set(ln, id);
        own.push(ln);
      }
    }
    const existing = nodes.get(id);
    if (existing) {
      existing.ownLines = [...new Set([...existing.ownLines, ...own])].sort((a, b) => a - b);
      existing.lines = [Math.min(existing.lines[0], startRow), Math.max(existing.lines[1], endRow)];
    } else {
      nodes.set(id, {
        id,
        repo,
        path: relPath,
        symbol: d.symbol,
        kind: d.kind,
        inScope: true,
        lines: [startRow, endRow],
        ownLines: own,
      });
    }
  }

  const modOwn = [];
  for (let ln = 1; ln <= lines.length; ln++) {
    if (claimedLine.has(ln)) continue;
    const trimmed = (lines[ln - 1] ?? '').trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
    modOwn.push(ln);
  }
  if (modOwn.length > 0) {
    const modId = `${repo}:${relPath}#${MODULE_SYMBOL}`;
    nodes.set(modId, {
      id: modId,
      repo,
      path: relPath,
      symbol: MODULE_SYMBOL,
      kind: 'module',
      inScope: true,
      lines: [modOwn[0], modOwn.at(-1)],
      ownLines: modOwn,
    });
  }

  const { defs } = foldMembers(nodes);
  const out = [];
  for (const def of defs.values()) {
    if (!def.ownLines.length) continue;
    const nonImportLines = def.ownLines.filter(ln => {
      const t = (lines[ln - 1] ?? '').trim();
      return t && !/^(import\s|export\s+\*\s+from\s|from\s+\S+\s+import\s|use\s+\w)/.test(t);
    });
    if (def.symbol === MODULE_SYMBOL && nonImportLines.length === 0) continue;
    out.push({ symbol: def.symbol, kind: def.kind, ownLines: def.ownLines });
  }
  return out;
}

/**
 * Resolve `web-tree-sitter` and `tree-sitter-wasms` if present in `node_modules` or `moduleSearchPaths`
 * and return an async `parseAst` hook compatible with `indexSourceFile({ parseAst })`.
 */
export async function createTreeSitterAstParser({ moduleSearchPaths = [] } = {}) {
  const candidates = [
    process.env.DOCS_IA_TREESITTER_NODE_MODULES,
    ...moduleSearchPaths,
  ].filter(Boolean);

  let webTreeSitterEntry = null;
  let wasmOutDir = null;

  try {
    const req = createRequire(import.meta.url);
    webTreeSitterEntry = req.resolve('web-tree-sitter');
    const wasmPkgJson = req.resolve('tree-sitter-wasms/package.json');
    wasmOutDir = join(wasmPkgJson, '..', 'out');
  } catch {
    for (const dir of candidates) {
      const wts = join(dir, 'web-tree-sitter');
      const wasms = join(dir, 'tree-sitter-wasms', 'out');
      if (existsSync(wts) && existsSync(wasms)) {
        const req = createRequire(join(dir, '_noop.js'));
        try {
          webTreeSitterEntry = req.resolve('web-tree-sitter');
          wasmOutDir = wasms;
          break;
        } catch {}
      }
    }
  }

  if (!webTreeSitterEntry || !wasmOutDir) {
    return { available: false, parseAst: null };
  }

  const mod = await import(pathToFileURL(webTreeSitterEntry).href);
  const Parser = mod.Parser || mod.default;
  const Language = mod.Language || Parser.Language;
  await Parser.init();

  const loadedLangs = new Map();
  const loadLang = async language => {
    if (!loadedLangs.has(language)) {
      const wasmPath = join(wasmOutDir, `tree-sitter-${language}.wasm`);
      loadedLangs.set(language, Language.load(wasmPath));
    }
    return loadedLangs.get(language);
  };

  const parseAst = async ({ repo, path: relPath, ext, text, lines }) => {
    const language = SUPPORTED_GRAMMARS[String(ext || '').toLowerCase()];
    if (!language) return null;
    const wasmLang = await loadLang(language);
    const parser = new Parser();
    parser.setLanguage(wasmLang);
    try {
      const tree = parser.parse(text);
      let activeRoot = tree.rootNode;
      let retryTree = null;
      if (tree.rootNode.hasError) {
        const patched = patchGrammarGaps(text, language);
        if (patched !== text) {
          retryTree = parser.parse(patched);
          if (errorCount(retryTree.rootNode) < errorCount(tree.rootNode)) {
            activeRoot = retryTree.rootNode;
          }
        }
      }
      const declarations = indexTreeSitterDeclarations(activeRoot, language);
      const defs = foldRawDeclarationsToDefs({ repo, path: relPath, lines, declarations });
      if (retryTree) retryTree.delete();
      tree.delete();
      return defs;
    } finally {
      parser.delete();
    }
  };

  return { available: true, parseAst };
}
