import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'fs';
import { inflateRawSync } from 'zlib';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

import { watchSkillSources } from '../dev-watcher.js';
import { partialRebuild } from '../build-phases.js';

const REAL_CONTEXT = join(import.meta.dirname, '..', '..', '..', 'context');

function readZipEntry(zipPath, entryName) {
    const zip = readFileSync(zipPath);
    const endOfDirectory = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    let entry = zip.readUInt32LE(endOfDirectory + 16);
    for (let i = 0; i < zip.readUInt16LE(endOfDirectory + 10); i++) {
        const method = zip.readUInt16LE(entry + 10);
        const compressedSize = zip.readUInt32LE(entry + 20);
        const nameLength = zip.readUInt16LE(entry + 28);
        const headerOffset = zip.readUInt32LE(entry + 42);
        const name = zip.toString('utf8', entry + 46, entry + 46 + nameLength);
        if (name === entryName) {
            const dataStart = headerOffset + 30 + zip.readUInt16LE(headerOffset + 26) + zip.readUInt16LE(headerOffset + 28);
            const data = zip.subarray(dataStart, dataStart + compressedSize);
            return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
        }
        entry += 46 + nameLength + zip.readUInt16LE(entry + 30) + zip.readUInt16LE(entry + 32);
    }
    throw new Error(`${entryName} not in ${zipPath}`);
}

describe('watchSkillSources', () => {
    let repoRoot;
    let distDir;
    let watcher;

    function write(relPath, content) {
        mkdirSync(dirname(join(repoRoot, relPath)), { recursive: true });
        writeFileSync(join(repoRoot, relPath), content);
    }

    const builtSkillMd = id => readZipEntry(join(distDir, 'skills', `${id}.zip`), 'SKILL.md');

    beforeEach(() => {
        repoRoot = mkdtempSync(join(tmpdir(), 'dev-watcher-test-'));
        distDir = join(repoRoot, 'dist');
        write('context/uri-schema.yaml', readFileSync(join(REAL_CONTEXT, 'uri-schema.yaml'), 'utf8'));
        write('context/commandments.yaml', 'commandments: {}\n');
        write('context/skip-patterns.yaml', 'global: {}\n');
        write('context/skills/setup/config.yaml', 'type: skill\ntemplate: description.md\nvariants:\n  - id: all\n    display_name: Setup\n');
        write('context/skills/setup/description.md', '# Setup\n\n- Set up environment variables:\n  {{> credentials}}\n');
        write('context/shared/credentials.md', '- Old token bullet.\n');
    });

    afterEach(async () => {
        await watcher?.close();
        rmSync(repoRoot, { recursive: true, force: true });
    });

    it('rebuilds a skill when a shared partial it includes changes', async () => {
        await partialRebuild({ ids: ['setup'], repoRoot, configDir: join(repoRoot, 'context'), distDir, version: 'test', docContents: {}, log: () => {} });
        expect(builtSkillMd('setup')).toContain('- Set up environment variables:\n  - Old token bullet.');

        watcher = watchSkillSources({ repoRoot, distDir, version: 'test', log: () => {} });
        await watcher.ready;
        write('context/shared/credentials.md', '- New token bullet.\n');

        await vi.waitFor(
            () => {
                const skillMd = builtSkillMd('setup');
                expect(skillMd).toContain('- Set up environment variables:\n  - New token bullet.');
                expect(skillMd).not.toContain('Old token bullet.');
            },
            { timeout: 4000, interval: 100 },
        );
    });
});
