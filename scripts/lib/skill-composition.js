/**
 * Skill composition
 *
 * A step skill with `framework_references` is written once for every framework.
 * Its consumer completes it from the framework's pack: the product's pages and
 * the rules file go into `references/`, and SKILL.md gets the framework's name
 * and the lines that list those files. The wizard does this when it installs
 * the skill; this module is the reference for it, and what the build checks use.
 */

import path from 'path';
import { VARIANT_FILE, FRAMEWORK_NAME, FRAMEWORK_DOCS, FRAMEWORK_RULES } from './skill-generator.js';

const referenceLine = (name, description) => `- \`references/${name}\` - ${description}`;

/**
 * Complete a step skill's files from a pack's files, both keyed by path.
 *
 * Files land in the order the build writes a variant: the product's pages,
 * then the step's own files, then the rules. A later file replaces an earlier
 * one of the same name, as it does there.
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
        const name = path.posix.basename(page.file);
        files[`references/${name}`] = take(page.file);
        docLines.push(referenceLine(name, page.description));
    }
    Object.assign(files, stepFiles);
    const ruleLines = [];
    if (variant.rules) {
        const name = path.posix.basename(variant.rules.file);
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

export { composeStepSkill, skillBody, skillFrontmatter };
