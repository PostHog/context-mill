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
const { generateAllSkills } = require('./lib/skill-generator');

const BUILD_VERSION = process.env.BUILD_VERSION || 'dev';

/**
 * Load URI schema configuration
 */
function loadUriSchema(configDir) {
    const content = fs.readFileSync(path.join(configDir, 'uri-schema.yaml'), 'utf8');
    return yaml.load(content);
}

/**
 * Create a ZIP archive for a skill directory
 * Returns the ZIP as a Buffer
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
 * Generate manifest with skill URIs and download URLs
 */
function generateManifest(skills, uriSchema, version) {
    const scheme = uriSchema.scheme;
    const skillPattern = uriSchema.patterns.skill;
    // Base URL for skill ZIP downloads
    // Production: GitHub releases (default)
    // Development: Local server (set via SKILLS_BASE_URL env var)
    const baseDownloadUrl = process.env.SKILLS_BASE_URL || 'https://github.com/PostHog/examples/releases/latest/download';

    return {
        version: uriSchema.manifest_version,
        buildVersion: version,
        buildTimestamp: new Date().toISOString(),
        skills: skills.map(skill => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            tags: skill.tags,
            uri: `${scheme}${skillPattern.replace('{id}', skill.id)}`,
            file: `${skill.id}.zip`,
            // URL where the ZIP can be downloaded directly
            downloadUrl: `${baseDownloadUrl}/${skill.id}.zip`,
        })),
    };
}

async function main() {
    console.log('Building Agent Skills...');
    console.log(`Version: ${BUILD_VERSION}\n`);

    const repoRoot = path.join(__dirname, '..');
    const configDir = path.join(repoRoot, 'transformation-config');
    const distDir = path.join(repoRoot, 'dist');
    const skillsDir = path.join(distDir, 'skills');
    const tempDir = path.join(distDir, 'skills-temp');
    const promptsDir = path.join(repoRoot, 'llm-prompts');

    try {
        // Ensure skills output directory exists
        fs.mkdirSync(skillsDir, { recursive: true });

        // Generate skill directories to temp location
        const skills = await generateAllSkills({
            repoRoot,
            configDir,
            outputDir: tempDir,
            promptsDir,
            version: BUILD_VERSION,
        });

        // Load URI schema
        const uriSchema = loadUriSchema(configDir);

        // Create ZIP for each skill - both as buffer and as standalone file
        console.log('\nCreating skill ZIPs...');
        const skillZips = {};
        for (const skill of skills) {
            const skillDir = path.join(tempDir, skill.id);
            const buffer = await zipSkillToBuffer(skillDir);
            const filename = `${skill.id}.zip`;
            skillZips[filename] = buffer;

            // Write standalone ZIP file to skills directory
            const standaloneZipPath = path.join(skillsDir, filename);
            fs.writeFileSync(standaloneZipPath, buffer);
            console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
        }

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });

        // Generate manifest
        const manifest = generateManifest(skills, uriSchema, BUILD_VERSION);

        // Write standalone manifest to skills directory
        const manifestPath = path.join(skillsDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`  ✓ manifest.json`);

        // Create bundled archive (for backwards compatibility)
        console.log('\nCreating bundled archive...');
        const bundlePath = path.join(distDir, 'skills-mcp-resources.zip');
        const bundleSize = await createBundledArchive(bundlePath, manifest, skillZips);
        console.log(`  ✓ skills-mcp-resources.zip (${(bundleSize / 1024).toFixed(1)} KB)`);

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('Build complete!\n');
        console.log('Standalone skills:', skillsDir);
        console.log('Bundle:', bundlePath);
        console.log('Skills:', skills.length);
        console.log('\nIndividual skill ZIPs (for direct download):');
        for (const skill of skills) {
            const downloadUrl = manifest.skills.find(s => s.id === skill.id)?.downloadUrl;
            console.log(`  - ${skill.id}.zip → ${downloadUrl}`);
        }

    } catch (e) {
        console.error('\n[FATAL] Build failed:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

main();
