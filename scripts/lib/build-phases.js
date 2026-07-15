/**
 * Build phases — shared helpers consumed by both the full builder
 * (`scripts/build.js`) and the partial dev rebuild path (`scripts/dev-server.js`).
 *
 * Everything that writes to `dist/` lives here, so the two callers can't drift.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import archiver from 'archiver';
import { generateSkillsByIds } from './skill-generator.js';
import { REPO_URL } from './constants.js';

/**
 * Load uri-schema.yaml.
 */
function loadUriSchema(configDir) {
    const content = fs.readFileSync(path.join(configDir, 'uri-schema.yaml'), 'utf8');
    return yaml.load(content);
}

/**
 * Load docs.yaml. Returns the `.docs` array, or [] if the file is absent.
 */
function loadDocsConfig(configDir) {
    const docsPath = path.join(configDir, 'docs.yaml');
    if (!fs.existsSync(docsPath)) return [];
    const loaded = yaml.load(fs.readFileSync(docsPath, 'utf8'));
    return loaded?.docs || [];
}

/**
 * Recover inlined doc text from a previous manifest.json. Used as a doc cache
 * so partial rebuilds don't refetch from posthog.com.
 *
 * Returns a map { docId → text } for every resource whose mimeType is
 * text/markdown and that has a `resource.text` field. Returns {} on missing
 * manifest.
 */
function loadDocContentsFromManifest(manifestPath) {
    if (!fs.existsSync(manifestPath)) return {};
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const result = {};
        for (const r of manifest.resources || []) {
            if (r.resource?.mimeType === 'text/markdown' && typeof r.resource?.text === 'string') {
                result[r.id] = r.resource.text;
            }
        }
        return result;
    } catch {
        return {};
    }
}

/**
 * ZIP a skill directory into a Buffer (level-9 deflate).
 */
async function zipSkillToBuffer(skillDir) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('data', chunk => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);

        archive.directory(skillDir, false);
        archive.finalize();
    });
}

/**
 * Stream a bundled archive (manifest.json plus the per-skill ZIP buffers) to disk.
 * Used only by full builds.
 */
async function createBundledArchive(outputPath, manifest, skillZips) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(archive.pointer()));
        archive.on('error', reject);

        archive.pipe(output);

        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
        for (const [filename, buffer] of Object.entries(skillZips)) {
            archive.append(buffer, { name: filename });
        }

        archive.finalize();
    });
}

/**
 * Build the manifest object. Pure — no I/O beyond reading env vars.
 *
 * `resources` is the merged list of skills + doc entries (already in the
 * manifest-builder shape: { id, name, description, tags, type, group, shortId }).
 * Doc entries are detected by `type === 'doc'` and a matching `docContents[id]` —
 * those get inlined under `resource.text`; everything else becomes a skill
 * resource with a download URL.
 */
function generateManifest({ resources, uriSchema, version, docContents = {} }) {
    const scheme = uriSchema.scheme;
    const skillPattern = uriSchema.patterns.skill;
    const docPattern = uriSchema.patterns.doc;

    const baseDownloadUrl = process.env.SKILLS_BASE_URL
        || (version && version !== 'dev'
            ? `${REPO_URL}/releases/download/v${version}`
            : `${REPO_URL}/releases/latest/download`);

    return {
        version: uriSchema.manifest_version,
        buildVersion: version,
        buildTimestamp: new Date().toISOString(),
        resources: resources.map(skill => {
            const isGuide = skill.type === 'doc' && docContents[skill.id];
            const uri = isGuide
                ? `${scheme}${docPattern.replace('{id}', skill.id)}`
                : `${scheme}${skillPattern.replace('{group}', skill.group).replace('{id}', skill.shortId)}`;
            const base = {
                // The MCP resource name is a short, human-readable label (per the
                // MCP spec) — use the display name, not the description sentence.
                // Clients that mint a tool per resource derive the tool name from
                // this; a sentence here overflows the 128-char tool-name limit and
                // 400s the whole request. Docs carry their short name in `name`.
                id: skill.id,
                name: skill.displayName ?? skill.name,
                description: skill.description,
                tags: skill.tags,
                uri,
            };

            if (isGuide) {
                return {
                    ...base,
                    resource: {
                        mimeType: 'text/markdown',
                        description: skill.description,
                        text: docContents[skill.id],
                    },
                };
            }

            const downloadUrl = `${baseDownloadUrl}/${skill.id}.zip`;
            return {
                ...base,
                file: `${skill.id}.zip`,
                downloadUrl,
                resource: {
                    mimeType: 'text/plain',
                    description: skill.description,
                    text: downloadUrl,
                },
            };
        }),
    };
}

/**
 * Compose the manifest + skill-menu and write both to dist/skills/.
 * Returns the manifest object so callers (notably full builds) can pass it
 * into createBundledArchive without re-parsing JSON.
 */
function writeManifestAndMenu({ allSkills, docContents, distDir, configDir, version }) {
    const skillsDir = path.join(distDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    const uriSchema = loadUriSchema(configDir);
    const docEntries = loadDocsConfig(configDir);

    const docResources = docEntries.map(d => ({
        id: d.id,
        type: 'doc',
        name: d.display_name,
        description: d.description,
        tags: d.tags || [],
    }));
    const allResources = [...allSkills, ...docResources];

    const manifest = generateManifest({ resources: allResources, uriSchema, version, docContents });

    fs.writeFileSync(path.join(skillsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    const skillsByCategory = {};
    for (const skill of allSkills) {
        const cat = skill.group;
        if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
        // `group` is the hyphenated skill-id prefix and `framework` the
        // detection id a variant serves, so a consumer resolves a bare skill
        // id + framework to a menu id by exact match instead of guessing from
        // id prefixes. `default: true` marks the variant a bare framework id
        // resolves to when a family has several (e.g. app vs pages router).
        const entry = {
            id: skill.id,
            name: skill.name,
            group: skill.group.replace(/\//g, '-'),
            downloadUrl: manifest.resources.find(r => r.id === skill.id)?.downloadUrl,
        };
        if (skill.framework) entry.framework = skill.framework;
        if (skill.default) entry.default = true;
        skillsByCategory[cat].push(entry);
    }

    // The CLI entries are the lookup table the wizard's runtime resolver uses
    // (parentCommand + command -> skillId). They live inside skill-menu.json
    // so the wizard can reach them through the existing fetchSkillMenu path.
    const cliEntries = generateCliEntries({ allSkills });

    const skillMenu = {
        version: manifest.version,
        buildVersion: manifest.buildVersion,
        categories: skillsByCategory,
        cliEntries,
    };
    fs.writeFileSync(path.join(skillsDir, 'skill-menu.json'), JSON.stringify(skillMenu, null, 2));

    return manifest;
}

/**
 * Build the CLI entries array from the expanded skill list. Used by
 * `writeManifestAndMenu` (which embeds the result in `skill-menu.json`
 * under `cliEntries`) and exercised directly by tests. Throws on an
 * invalid `default:` arrangement (see `validateDefault`) so the
 * build fails before bad data reaches the wizard.
 *
 * Only skills with a `cli` block participate. Untagged skills implicitly
 * have the `skill` role (already reachable via `skill-menu.json` and
 * `manifest.json`) and are not emitted here.
 *
 * Entry shape:
 *   { skillId, role, command?, parentCommand?, default?, displayName, description }
 *
 * Entries are sorted by role (command first, then skill, then internal),
 * then by `parentCommand`/`command` so diffs in `skill-menu.json` stay
 * reviewable.
 */
function generateCliEntries({ allSkills }) {
    const roleOrder = { command: 0, skill: 1, internal: 2 };
    const entries = allSkills
        .filter(s => s.cli)
        .map(s => {
            const entry = {
                skillId: s.id,
                role: s.cli.role,
            };
            if (s.cli.parentCommand) entry.parentCommand = s.cli.parentCommand;
            if (s.cli.command) entry.command = s.cli.command;
            if (s.cli.default) entry.default = true;
            entry.displayName = s.displayName;
            entry.description = s.description;
            return entry;
        })
        .sort((a, b) => {
            const roleDiff = roleOrder[a.role] - roleOrder[b.role];
            if (roleDiff !== 0) return roleDiff;
            const parentDiff = (a.parentCommand || '').localeCompare(b.parentCommand || '');
            if (parentDiff !== 0) return parentDiff;
            return (a.command || '').localeCompare(b.command || '');
        });
    validateDefault(entries);
    return entries;
}

/**
 * Enforce the `default:` rules: at most one default leaf per family
 * (grouped by `parentCommand`), and no `default` without a `parentCommand`
 * (nothing to highlight). Checked here because a family spans multiple skill
 * directories. Throws naming the offending `skillId`s.
 */
function validateDefault(entries) {
    const defaultByParent = new Map();
    for (const entry of entries) {
        if (!entry.default) continue;
        if (!entry.parentCommand) {
            throw new Error(
                `cli.default is only valid on a leaf inside a family (a command with a parentCommand); "${entry.skillId}" sets default but has no parentCommand`,
            );
        }
        const siblings = defaultByParent.get(entry.parentCommand) || [];
        siblings.push(entry.skillId);
        defaultByParent.set(entry.parentCommand, siblings);
    }
    for (const [parentCommand, skillIds] of defaultByParent) {
        if (skillIds.length > 1) {
            throw new Error(
                `Family "${parentCommand}" has more than one cli.default leaf (${skillIds.join(', ')}); at most one is allowed`,
            );
        }
    }
}

/**
 * Delete `dist/skills/<id>.zip` files whose IDs are no longer in `allSkills`.
 * Returns the array of removed filenames.
 */
function reconcileOrphans({ allSkills, distDir, log = () => {} }) {
    const skillsDir = path.join(distDir, 'skills');
    if (!fs.existsSync(skillsDir)) return [];

    const validIds = new Set(allSkills.map(s => s.id));
    const removed = [];

    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.zip')) continue;
        const id = entry.name.slice(0, -4);
        if (validIds.has(id)) continue;
        const fullPath = path.join(skillsDir, entry.name);
        fs.rmSync(fullPath);
        removed.push(entry.name);
        log(`🗑  Removed orphan: ${entry.name}`);
    }

    return removed;
}

/**
 * Partial rebuild — the dev server's main entry point.
 *
 * Generates only the skills listed in `ids` into a temp dir, ZIPs each into
 * `dist/skills/`, then rewrites the manifest and skill-menu using the full
 * skill list (so manifest stays current even when only some skills changed)
 * and removes any orphan `dist/skills/<id>.zip` files no longer in the list.
 *
 * `docContents` is passed in by the caller — partial rebuilds never touch the
 * network; they carry the doc cache forward from the prior manifest.
 */
async function partialRebuild({
    ids,
    repoRoot,
    configDir,
    distDir,
    version,
    docContents,
    log = console.log,
}) {
    const skillsDir = path.join(distDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    const tempDir = path.join(distDir, '.skills-partial-temp');
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        const { allSkills, rebuiltSkills } = await generateSkillsByIds({
            ids,
            repoRoot,
            configDir,
            outputDir: tempDir,
            version,
        });

        for (const skill of rebuiltSkills) {
            const skillTempDir = path.join(tempDir, skill.id);
            const buffer = await zipSkillToBuffer(skillTempDir);
            const filename = `${skill.id}.zip`;
            fs.writeFileSync(path.join(skillsDir, filename), buffer);
            log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
        }

        writeManifestAndMenu({ allSkills, docContents, distDir, configDir, version });
        reconcileOrphans({ allSkills, distDir, log });

        return { allSkills, rebuiltSkills };
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

export {
    loadUriSchema,
    loadDocsConfig,
    loadDocContentsFromManifest,
    zipSkillToBuffer,
    createBundledArchive,
    generateManifest,
    generateCliEntries,
    writeManifestAndMenu,
    reconcileOrphans,
    partialRebuild,
};
