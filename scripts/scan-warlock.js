#!/usr/bin/env node

/**
 * Scan skills for security threats using Warlock.
 *
 * Two modes:
 *   node scripts/scan-warlock.js dist/skills        # Scan built skill ZIPs (build/CI)
 *   node scripts/scan-warlock.js path/to/file.md    # Scan specific file(s) (local)
 *
 * Exits 0 if clean, 1 if threats found.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.yaml', '.yml', '.json',
  '.js', '.ts', '.py', '.rb', '.sh',
]);

const isCI = Boolean(process.env.CI);

// Rules that produce false positives on context-mill's own content.
// These are reported as warnings (visible but don't fail the build).
// TODO: either tighten these rules in Warlock or add an LLM triage layer, then remove this list.
const WARN_ONLY_RULES = new Set([
  'prompt_injection_role_hijack',                // "You are now logged in" in example UI code
  'prompt_injection_posthog_integration_attack',  // legit docs about removing/migrating PostHog
  'prompt_injection_posthog_feature_attack',      // legit docs about disabling features
  'posthog_hardcoded_personal_api_key',           // placeholder phx_ keys in migration guides
  'prompt_injection_base64_in_comment',           // base64 in fetched HTML docs (fonts, images, scripts)
]);

// -- Colors (disabled in CI where annotations do the work) --

const color = isCI
  ? { red: (s) => s, yellow: (s) => s, green: (s) => s, bold: (s) => s, dim: (s) => s }
  : {
      red:    (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      green:  (s) => `\x1b[32m${s}\x1b[0m`,
      bold:   (s) => `\x1b[1m${s}\x1b[0m`,
      dim:    (s) => `\x1b[2m${s}\x1b[0m`,
    };

// -- Helpers --

/** Recursively collect text files from a directory. */
function collectTextFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(full));
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

/** Extract a ZIP and return the temp directory it was extracted to. */
function extractZip(zipPath, tmpDir) {
  const name = path.basename(zipPath, '.zip');
  const dest = path.join(tmpDir, name);
  fs.mkdirSync(dest, { recursive: true });
  try {
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', dest], { stdio: 'pipe' });
    return dest;
  } catch {
    console.warn(isCI ? `::warning::Failed to extract ${path.basename(zipPath)}` : `  Warning: failed to extract ${path.basename(zipPath)}, skipping`);
    return null;
  }
}

function reportMatch(filePath, match) {
  const { rule, metadata } = match;
  const sev = metadata.severity || 'unknown';
  const cat = metadata.category || 'unknown';
  const isWarnOnly = WARN_ONLY_RULES.has(rule);

  if (isCI) {
    const level = isWarnOnly ? 'warning' : 'error';
    console.log(`::${level} file=${filePath}::${isWarnOnly ? 'WARNING' : 'THREAT DETECTED'} [${sev}] ${rule}: ${metadata.description || ''}`);
  }

  const label = isWarnOnly
    ? `  ${color.yellow(color.bold('WARNING'))}  [${color.yellow(sev)}] ${cat}`
    : `  ${color.red(color.bold('THREAT DETECTED'))}  [${color.red(sev)}] ${cat}`;
  console.log(label);
  console.log(`  ${color.dim('Rule:')}     ${rule}`);
  console.log(`  ${color.dim('File:')}     ${filePath}`);
  if (metadata.description)  console.log(`  ${color.dim('Why:')}      ${metadata.description}`);
  if (metadata.remediation)  console.log(`  ${color.dim('Fix:')}      ${metadata.remediation}`);
  if (metadata.action)       console.log(`  ${color.dim('Action:')}   ${metadata.action}`);
  console.log('');
}

// -- Main --

async function main() {
  const { scan } = require('@posthog/warlock');

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node scripts/scan-warlock.js dist/skills       # Scan built skill ZIPs');
    console.log('  node scripts/scan-warlock.js path/to/file.md   # Scan specific file(s)');
    process.exit(1);
  }

  // Determine what to scan
  let filesToScan = []; // { label: string, filePath: string }
  let tmpDir = null;

  const firstArg = args[0];
  const isSingleDir = args.length === 1 && fs.existsSync(firstArg) && fs.statSync(firstArg).isDirectory();

  if (isSingleDir) {
    const dir = firstArg;
    const zips = fs.readdirSync(dir).filter((f) => f.endsWith('.zip'));

    if (zips.length > 0) {
      // ZIP mode: extract and scan each archive
      console.log(`Scanning ${zips.length} skill archive(s) with Warlock...\n`);
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warlock-scan-'));
      for (const zip of zips) {
        const extracted = extractZip(path.join(dir, zip), tmpDir);
        if (!extracted) continue;
        for (const f of collectTextFiles(extracted)) {
          const relPath = path.relative(extracted, f);
          filesToScan.push({ label: `${zip} > ${relPath}`, filePath: f });
        }
      }
    } else {
      // Directory without ZIPs: scan text files directly
      const files = collectTextFiles(dir);
      console.log(`Scanning ${files.length} file(s) in ${dir} with Warlock...\n`);
      for (const f of files) {
        filesToScan.push({ label: path.relative(process.cwd(), f), filePath: f });
      }
    }
  } else {
    // Individual files mode
    for (const arg of args) {
      if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
        filesToScan.push({ label: path.relative(process.cwd(), arg), filePath: arg });
      } else {
        console.error(`File not found: ${arg}`);
      }
    }
    console.log(`Scanning ${filesToScan.length} file(s) with Warlock...\n`);
  }

  // Run scans
  let threats = 0;
  let warnings = 0;

  for (const { label, filePath } of filesToScan) {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = await scan(content);

    if (result.matched) {
      for (const match of result.matches) {
        reportMatch(label, match);
        if (WARN_ONLY_RULES.has(match.rule)) {
          warnings++;
        } else {
          threats++;
        }
      }
    }
  }

  // Cleanup
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });

  // Summary
  console.log('---');
  if (warnings > 0) {
    console.log(color.yellow(`${warnings} warning(s) from known noisy rules (not blocking).`));
  }
  if (threats > 0) {
    console.log(color.red(`FAILED: ${threats} threat(s) detected.`));
    console.log('Fix the flagged content before releasing.');
    process.exit(1);
  } else {
    console.log(color.green(`PASSED: No threats found in ${filesToScan.length} file(s).`));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Scan failed:', err);
  process.exit(2);
});
