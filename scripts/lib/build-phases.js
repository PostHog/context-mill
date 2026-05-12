/**
 * Build phases — composable steps that both the full `npm run build` (scripts/build.js)
 * and the dev-server's incremental rebuild path (scripts/dev-server.js) call.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const archiver = require('archiver');
const { generateSkillsByIds, fetchDoc } = require('./skill-generator');
const { REPO_URL } = require('./constants');

/**
 * Load URI schema configuration
 */
function loadUriSchema(configDir) {
    const content = fs.readFileSync(path.join(configDir, 'uri-schema.yaml'), 'utf8');
    return yaml.load(content);
}

/**
 * Load docs.yaml entries (inline doc resources). Returns [] if the file is absent.
 */
function loadDocsConfig(configDir) {
    const docsConfigPath = path.join(configDir, 'docs.yaml');
    if (!fs.existsSync(docsConfigPath)) return [];
    return yaml.load(fs.readFileSync(docsConfigPath, 'utf8')).docs || [];
}

/**
 * Recover the inline doc text PostHog produced last build by reading manifest.json.
 * Used by the dev server to keep doc resources stable across partial rebuilds without
 * refetching them from posthog.com.
 */
function loadDocContentsFromManifest(manifestPath) {
    if (!fs.existsSync(manifestPath)) return {};
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const out = {};
    for (const r of manifest.resources || []) {
        if (r.resource?.mimeType === 'text/markdown' && r.resource.text) {
            out[r.id] = r.resource.text;
        }
    }
    return out;
}

/**
 * Zip a single skill directory into a Buffer.
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
 * Bundle the manifest plus a set of skill ZIPs into skills-mcp-resources.zip.
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
 * Generate manifest.json content (no I/O). Mirrors the prior build.js logic.
 */
function generateManifest({ resources, uriSchema, version, docContents }) {
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
                id: skill.id,
                name: skill.name,
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
 * Write manifest.json + skill-menu.json to disk from the given full skill list.
 * Returns the manifest object for callers that want to bundle it.
 */
function writeManifestAndMenu({ allSkills, docContents, distDir, configDir, version }) {
    const skillsDir = path.join(distDir, 'skills');
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
        skillsByCategory[cat].push({
            id: skill.id,
            name: skill.name,
            downloadUrl: manifest.resources.find(r => r.id === skill.id)?.downloadUrl,
        });
    }
    const skillMenu = {
        version: manifest.version,
        buildVersion: manifest.buildVersion,
        categories: skillsByCategory,
    };
    fs.writeFileSync(path.join(skillsDir, 'skill-menu.json'), JSON.stringify(skillMenu, null, 2));

    return manifest;
}

/**
 * Delete dist/skills/{id}.zip files whose ID isn't present in the current expanded
 * skill list. Logs each removal. Cheap; one readdir + N unlinks.
 */
function reconcileOrphans({ allSkills, distDir, log = () => {} }) {
    const skillsDir = path.join(distDir, 'skills');
    if (!fs.existsSync(skillsDir)) return [];

    const validIds = new Set(allSkills.map(s => s.id));
    const removed = [];
    for (const file of fs.readdirSync(skillsDir)) {
        if (!file.endsWith('.zip')) continue;
        const id = file.slice(0, -4);
        if (!validIds.has(id)) {
            fs.unlinkSync(path.join(skillsDir, file));
            removed.push(file);
            log(`🗑  Removed orphan: ${file}`);
        }
    }
    return removed;
}

/**
 * Partial rebuild path — used by the dev server. Generates the requested skills
 * into a temp dir, ZIPs them into dist/skills/, regenerates manifest+menu, and
 * reconciles orphans. Skips the bundled archive and marketplace tree.
 */
async function partialRebuild({ ids, repoRoot, configDir, distDir, promptsDir, version, docContents, log = () => {} }) {
    const skillsDir = path.join(distDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    const tempDir = path.join(distDir, '.skills-partial-temp');
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    let allSkills, rebuiltSkills;
    try {
        ({ allSkills, rebuiltSkills } = await generateSkillsByIds({
            ids,
            repoRoot,
            configDir,
            outputDir: tempDir,
            promptsDir,
            version,
        }));

        for (const skill of rebuiltSkills) {
            const skillDir = path.join(tempDir, skill.id);
            const buffer = await zipSkillToBuffer(skillDir);
            fs.writeFileSync(path.join(skillsDir, `${skill.id}.zip`), buffer);
            log(`  ✓ ${skill.id}.zip (${(buffer.length / 1024).toFixed(1)} KB)`);
        }
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    writeManifestAndMenu({ allSkills, docContents, distDir, configDir, version });
    reconcileOrphans({ allSkills, distDir, log });

    return { allSkills, rebuiltSkills };
}

module.exports = {
    loadUriSchema,
    loadDocsConfig,
    loadDocContentsFromManifest,
    zipSkillToBuffer,
    createBundledArchive,
    generateManifest,
    writeManifestAndMenu,
    reconcileOrphans,
    partialRebuild,
};
