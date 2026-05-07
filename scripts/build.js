#!/usr/bin/env node

/**
 * Build Skills
 *
 * Generates Agent Skills packages from configuration.
 * Creates a single skills-mcp-resources.zip containing:
 * - manifest.json (skills manifest)
 * - Individual skill ZIPs ({skill-id}.zip)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const archiver = require('archiver');
const { generateAllSkills, loadSkillsConfig, fetchDoc } = require('./lib/skill-generator');
const { generateMarketplace } = require('./lib/marketplace-generator');
const { REPO_URL } = require('./lib/constants');
const { zipSkillToBuffer } = require('./lib/zip');

const BUILD_VERSION = process.env.BUILD_VERSION || 'dev';

/**
 * Load URI schema configuration
 */
function loadUriSchema(configDir) {
    const content = fs.readFileSync(path.join(configDir, 'uri-schema.yaml'), 'utf8');
    return yaml.load(content);
}

/**
 * Create the bundled skills-mcp-resources.zip
 */
async function createBundledArchive(outputPath, manifest, skillZips) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(archive.pointer()));
        archive.on('error', reject);

        archive.pipe(output);

        // Add manifest.json
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

        // Add each skill ZIP
        for (const [filename, buffer] of Object.entries(skillZips)) {
            archive.append(buffer, { name: filename });
        }

        archive.finalize();
    });
}


/**
 * Generate manifest with skill URIs, download URLs, and MCP resource representations
 */
function generateManifest(skills, uriSchema, version, guideContents = {}) {
    const scheme = uriSchema.scheme;
    const skillPattern = uriSchema.patterns.skill;
    const docPattern = uriSchema.patterns.doc;
    // Base URL for skill ZIP downloads
    // Production: GitHub releases pinned to the build version
    // Development: Local server (set via SKILLS_BASE_URL env var), or latest release
    const baseDownloadUrl = process.env.SKILLS_BASE_URL
        || (version && version !== 'dev'
            ? `${REPO_URL}/releases/download/v${version}`
            : `${REPO_URL}/releases/latest/download`);

    return {
        version: uriSchema.manifest_version,
        buildVersion: version,
        buildTimestamp: new Date().toISOString(),
        resources: skills.map(skill => {
            const isGuide = skill.type === 'doc' && guideContents[skill.id];
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
                        text: guideContents[skill.id],
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
 * Fetch and concatenate docs for a guide resource
 */
async function fetchDocContent(doc) {
    const parts = [];
    for (const url of (doc.urls || [])) {
        console.log(`  Fetching doc: ${url}`);
        const result = await fetchDoc(url);
        if (result) {
            parts.push(result.content);
        }
    }
    return parts.join('\n\n---\n\n');
}

async function main() {
    console.log('Building resources...');
    console.log(`Version: ${BUILD_VERSION}\n`);

    const repoRoot = path.join(__dirname, '..');
    const configDir = path.join(repoRoot, 'transformation-config');
    const distDir = path.join(repoRoot, 'dist');
    const skillsDir = path.join(distDir, 'skills');
    const tempDir = path.join(distDir, 'skills-temp');
    const promptsDir = path.join(repoRoot, 'llm-prompts');

    try {
        fs.mkdirSync(skillsDir, { recursive: true });

        // Generate skill packages via generator
        const skills = await generateAllSkills({
            repoRoot,
            configDir,
            outputDir: tempDir,
            promptsDir,
            version: BUILD_VERSION,
        });

        // Load docs config
        const docsConfigPath = path.join(configDir, 'docs.yaml');
        const docEntries = fs.existsSync(docsConfigPath)
            ? yaml.load(fs.readFileSync(docsConfigPath, 'utf8')).docs || []
            : [];

        const uriSchema = loadUriSchema(configDir);

        // Create ZIP for each skill
        console.log('\nCreating skill ZIPs...');
        const skillZips = {};
        for (const skill of skills) {
            const skillDir = path.join(tempDir, skill.id);
            const buffer = await zipSkillToBuffer(skillDir);
            const filename = `${skill.id}.zip`;
            skillZips[filename] = buffer;

            const standaloneZipPath = path.join(skillsDir, filename);
            fs.writeFileSync(standaloneZipPath, buffer);
            console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
        }

        // Generate marketplace plugin directories (before tempDir cleanup)
        console.log('\nGenerating marketplace plugins...');
        const marketplaceResult = generateMarketplace({
            skills,
            tempDir,
            version: BUILD_VERSION,
            outputDir: distDir,
            configDir,
        });

        fs.rmSync(tempDir, { recursive: true, force: true });

        // Fetch doc content directly (no generator, no ZIP)
        const docContents = {};
        if (docEntries.length > 0) {
            console.log('\nFetching doc resources...');
            for (const doc of docEntries) {
                console.log(`\nDoc: ${doc.id}`);
                docContents[doc.id] = await fetchDocContent(doc);
                console.log(`  ✓ ${doc.id} (${docContents[doc.id].length} chars)`);
            }
        }

        // Build unified resource list for manifest
        const docResources = docEntries.map(d => ({
            id: d.id,
            type: 'doc',
            name: d.display_name,
            description: d.description,
            tags: d.tags || [],
        }));
        const allResources = [...skills, ...docResources];

        // Generate manifest
        const manifest = generateManifest(allResources, uriSchema, BUILD_VERSION, docContents);

        const manifestPath = path.join(skillsDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`\n  ✓ manifest.json`);

        // Generate skill-menu.json: condensed list grouped by category
        // The wizard agent filters by category to keep context small
        const skillsByCategory = {};
        for (const skill of skills) {
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
        const skillMenuPath = path.join(skillsDir, 'skill-menu.json');
        fs.writeFileSync(skillMenuPath, JSON.stringify(skillMenu, null, 2));
        console.log(`  ✓ skill-menu.json (${Object.keys(skillsByCategory).length} categories, ${skills.length} skills)`);

        // Write fetched docs marked as release_asset to skills dir (uploaded as release assets)
        const releaseAssetDocs = docEntries.filter(d => d.release_asset);
        if (releaseAssetDocs.length > 0) {
            console.log('\nWriting release-asset docs...');
            for (const doc of releaseAssetDocs) {
                const content = docContents[doc.id];
                if (content) {
                    const filename = `${doc.id}.md`;
                    fs.writeFileSync(path.join(skillsDir, filename), content);
                    console.log(`  ✓ ${filename} (${content.length} chars)`);
                }
            }
        }

        // Create bundled archive
        console.log('\nCreating bundled archive...');
        const bundlePath = path.join(distDir, 'skills-mcp-resources.zip');
        const bundleSize = await createBundledArchive(bundlePath, manifest, skillZips);
        console.log(`  ✓ skills-mcp-resources.zip (${(bundleSize / 1024).toFixed(1)} KB)`);

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('Build complete!\n');
        console.log('Output:', skillsDir);
        console.log('Bundle:', bundlePath);
        console.log(`Resources: ${allResources.length} (${skills.length} skills, ${docEntries.length} docs)`);
        console.log('\nSkill ZIPs:');
        for (const skill of skills) {
            const downloadUrl = manifest.resources.find(s => s.id === skill.id)?.downloadUrl;
            console.log(`  - ${skill.id}.zip → ${downloadUrl}`);
        }
        if (docEntries.length > 0) {
            console.log('\nInline docs:');
            for (const doc of docEntries) {
                console.log(`  - ${doc.id} (${docContents[doc.id].length} chars)`);
            }
        }
        console.log(`\nMarketplace: ${marketplaceResult.marketplaceDir}`);
        console.log(`  ${marketplaceResult.pluginCount} plugins, ${marketplaceResult.skillCount} skills`);

    } catch (e) {
        console.error('\n[FATAL] Build failed:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

main();
