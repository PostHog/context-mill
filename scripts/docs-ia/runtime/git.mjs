// Deterministic git helpers with optional disk caching and `--no-lazy-fetch`
// so partial clones never trigger surprise network stalls during replay or refresh.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeLineEndings } from '../models/pin.mjs';

export function createGitReader({ repoPaths = {}, cacheDir = null, allowLazyFetch = false } = {}) {
  if (cacheDir) mkdirSync(cacheDir, { recursive: true });

  const resolveRepoDir = repo => {
    const dir = repoPaths[repo];
    if (!dir) throw new Error(`Unknown repository "${repo}" (not configured in repoPaths)`);
    return dir;
  };

  const gitArgs = (repoDir, args) => (
    allowLazyFetch ? ['-C', repoDir, ...args] : ['--no-lazy-fetch', '-C', repoDir, ...args]
  );

  function readFileAtCommit(repo, commit, relPath) {
    let cachePath = null;
    if (cacheDir) {
      const key = createHash('sha1').update(`${repo}:${commit}:${relPath}`).digest('hex');
      cachePath = join(cacheDir, `${key}.json`);
      if (existsSync(cachePath)) {
        return JSON.parse(readFileSync(cachePath, 'utf8')).text;
      }
    }
    const repoDir = resolveRepoDir(repo);
    let text = null;
    try {
      text = normalizeLineEndings(
        execFileSync('git', gitArgs(repoDir, ['show', `${commit}:${relPath}`]), {
          encoding: 'utf8',
          maxBuffer: 16 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'ignore'],
        })
      );
    } catch {
      text = null;
    }
    if (cachePath) {
      writeFileSync(cachePath, JSON.stringify({ repo, commit, path: relPath, text }));
    }
    return text;
  }

  function listTreeAtCommit(repo, commit, prefixes = []) {
    const repoDir = resolveRepoDir(repo);
    const tail = prefixes.length ? ['--', ...prefixes] : [];
    try {
      return execFileSync('git', gitArgs(repoDir, ['ls-tree', '-r', '--name-only', commit, ...tail]), {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\n')
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function resolveHead(repo) {
    const repoDir = resolveRepoDir(repo);
    return execFileSync('git', ['-C', repoDir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  }

  function diffFiles(repo, fromCommit, toCommit) {
    const repoDir = resolveRepoDir(repo);
    return execFileSync('git', gitArgs(repoDir, ['diff', '--name-status', fromCommit, toCommit]), {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [status, ...paths] = line.split('\t');
        return { status, path: paths.at(-1), oldPath: paths.length > 1 ? paths[0] : null };
      });
  }

  return { readFileAtCommit, listTreeAtCommit, resolveHead, diffFiles };
}
