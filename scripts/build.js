#!/usr/bin/env node

/**
 * Build Skills
 *
 * Generates Agent Skills packages from configuration.
 * Creates a single skills-mcp-resources.zip containing:
 * - manifest.json (skills manifest)
 * - Individual skill ZIPs ({skill-id}.zip)
 */

import fs from 'fs';
import path from 'path';
import { generateAllSkills, fetchDoc } from './lib/skill-generator.js';
import { buildAgents } from './lib/agent-generator.js';
import { generateMarketplace } from './lib/marketplace-generator.js';
import {
    loadDocsConfig,
    zipSkillToBuffer,
    createBundledArchive,
    writeManifestAndMenu,
} from './lib/build-phases.js';

const BUILD_VERSION = process.env.BUILD_VERSION || 'dev';

/**
 * Fetch and concatenate docs for a guide resource
 */
async function fetchDocContent(doc) {
    const parts = [];
    for (const url of (doc.urls || [])) {
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

    const repoRoot = path.join(import.meta.dirname, '..');
    const configDir = path.join(repoRoot, 'context');
    const distDir = path.join(repoRoot, 'dist');
    const skillsDir = path.join(distDir, 'skills');
    const tempDir = path.join(distDir, 'skills-temp');

    try {
        fs.mkdirSync(skillsDir, { recursive: true });

        const skills = await generateAllSkills({
            repoRoot,
            configDir,
            outputDir: tempDir,
            version: BUILD_VERSION,
        });

        const docEntries = loadDocsConfig(configDir);

        console.log('\nCreating skill ZIPs...');
        const skillZips = {};
        for (const skill of skills) {
            const skillDir = path.join(tempDir, skill.id);
            const buffer = await zipSkillToBuffer(skillDir);
            const filename = `${skill.id}.zip`;
            skillZips[filename] = buffer;

            fs.writeFileSync(path.join(skillsDir, filename), buffer);
            console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
        }

        console.log('\nGenerating marketplace plugins...');
        const marketplaceResult = generateMarketplace({
            skills,
            tempDir,
            version: BUILD_VERSION,
            outputDir: distDir,
            configDir,
        });

        fs.rmSync(tempDir, { recursive: true, force: true });

        const docContents = {};
        if (docEntries.length > 0) {
            console.log('\nFetching doc resources...');
            for (const doc of docEntries) {
                console.log(`\nDoc: ${doc.id}`);
                docContents[doc.id] = await fetchDocContent(doc);
                console.log(`  ✓ ${doc.id} (${docContents[doc.id].length} chars)`);
            }
        }

        const manifest = writeManifestAndMenu({
            allSkills: skills,
            docContents,
            distDir,
            configDir,
            version: BUILD_VERSION,
        });
        console.log(`\n  ✓ manifest.json`);

        const skillMenu = JSON.parse(fs.readFileSync(path.join(skillsDir, 'skill-menu.json'), 'utf8'));
        console.log(`  ✓ skill-menu.json (${Object.keys(skillMenu.categories).length} categories, ${skills.length} skills)`);

        console.log('\nBuilding agent prompts...');
        const agentsResult = buildAgents({
            configDir,
            distDir,
            baseUrl: process.env.AGENTS_BASE_URL,
            version: BUILD_VERSION,
        });
        console.log(`  ✓ ${agentsResult.count} agent prompt(s) → dist/agents/ + agent-menu.json`);

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

        console.log('\nCreating bundled archive...');
        const bundlePath = path.join(distDir, 'skills-mcp-resources.zip');
        const bundleSize = await createBundledArchive(bundlePath, manifest, skillZips);
        console.log(`  ✓ skills-mcp-resources.zip (${(bundleSize / 1024).toFixed(1)} KB)`);

        console.log('\n' + '='.repeat(50));
        console.log('Build complete!\n');
        console.log('Output:', skillsDir);
        console.log('Bundle:', bundlePath);
        console.log(`Resources: ${manifest.resources.length} (${skills.length} skills, ${docEntries.length} docs)`);
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
