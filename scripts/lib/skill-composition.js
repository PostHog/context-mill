/**
 * Skill composition
 *
 * A step skill with `framework_references` is written once for every framework.
 * Its consumer completes it from the framework's pack: the product's pages and
 * the rules file go into `references/`, and SKILL.md gets the framework's name
 * and the lines that list those files. The wizard does this when it installs
 * the skill; this module is the reference for it, and what the build checks use.
 */

import { VARIANT_FILE, FRAMEWORK_NAME, FRAMEWORK_DOCS, FRAMEWORK_RULES, referenceLine } from './skill-generator.js';

/** One plain part of a path: it starts with a letter or digit and has no separator. */
const PLAIN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * A pack file's name in the skill's `references/`. A consumer scans an installed
 * skill by lowercase extension and skips dotfiles, so a page that scan would
 * skip is refused: every part of its path is plain and it ends in `.md`.
 */
function referenceName(file) {
    const parts = String(file).split('/');
    const name = parts[parts.length - 1];
    if (!parts.every(part => PLAIN_NAME.test(part)) || !name.endsWith('.md')) {
        throw new Error(`Unusable reference name: ${file}`);
    }
    return name;
}

/**
 * Complete a step skill's files from a pack's files, both keyed by path.
 *
 * Files land in the order the build writes a variant: the product's pages,
 * then the step's own files, then the rules. A later file replaces an earlier
 * one of the same name. The build gives two pages of one folder different
 * names, so that only happens between a pack's page and a step's own file.
 */
function composeStepSkill({ stepFiles, packFiles, product }) {
    if (!(VARIANT_FILE in packFiles)) {
        throw new Error(`The pack has no ${VARIANT_FILE}`);
    }
    const variant = JSON.parse(packFiles[VARIANT_FILE]);
    const pages = variant.products?.[product];
    if (!Array.isArray(pages)) {
        throw new Error(`The pack "${variant.id}" lists no ${product} pages`);
    }

    const take = file => {
        if (!(file in packFiles)) throw new Error(`The pack "${variant.id}" lists ${file} and does not ship it`);
        return packFiles[file];
    };
    const files = {};
    const docLines = [];
    for (const page of pages) {
        const name = referenceName(page.file);
        files[`references/${name}`] = take(page.file);
        docLines.push(referenceLine(name, page.description));
    }
    Object.assign(files, stepFiles);
    const ruleLines = [];
    if (variant.rules) {
        const name = referenceName(variant.rules.file);
        files[`references/${name}`] = take(variant.rules.file);
        ruleLines.push(referenceLine(name, variant.rules.description));
    }

    files['SKILL.md'] = stepFiles['SKILL.md']
        .split('\n')
        .flatMap(line => (line === FRAMEWORK_DOCS ? docLines : line === FRAMEWORK_RULES ? ruleLines : [line]))
        .join('\n')
        .replaceAll(FRAMEWORK_NAME, variant.displayName);
    return files;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n\n?/;

/** A SKILL.md without its frontmatter. */
function skillBody(text) {
    return text.replace(FRONTMATTER, '');
}

/** A SKILL.md's frontmatter without `name`, the one field a skill and the one it replaces must differ in. */
function skillFrontmatter(text) {
    return (FRONTMATTER.exec(text)?.[1] ?? '')
        .split('\n')
        .filter(line => !line.startsWith('name:'))
        .join('\n');
}

/**
 * What differs between a skill and the skill that stands in for it, both keyed by path.
 * They have the same files with the same bytes, and the same SKILL.md but for the `name` in its frontmatter.
 * Returns one line per difference, and none when the stand-in reads the same.
 */
function compareSkills(replaced, replacement) {
    const differences = [];
    for (const file of new Set([...Object.keys(replaced), ...Object.keys(replacement)])) {
        if (!(file in replacement)) differences.push(`${file} is missing`);
        else if (!(file in replaced)) differences.push(`${file} is new`);
        else if (file === 'SKILL.md') {
            if (skillBody(replaced[file]) !== skillBody(replacement[file])) differences.push('SKILL.md reads differently');
            if (skillFrontmatter(replaced[file]) !== skillFrontmatter(replacement[file])) differences.push('SKILL.md frontmatter differs');
        } else if (replaced[file] !== replacement[file]) differences.push(`${file} differs`);
    }
    return differences;
}

export { composeStepSkill, compareSkills, skillBody, skillFrontmatter };
