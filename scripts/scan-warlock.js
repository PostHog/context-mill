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

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { scan, triageMatches } from "@posthog/warlock";
import { createTriageClassifier, TRIAGE_MODEL_ID } from "./lib/triage-classifier.js";

// Text-based formats we feed to Warlock. Binary/unknown types are skipped on
// purpose, since Warlock scans text content and non-text files add nothing.
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".yaml",
  ".yml",
  ".json",
  ".toml",
  ".xml",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".rb",
  ".sh",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".kts",
  ".swift",
  ".php",
  ".c",
  ".h",
  ".cpp",
  ".cc",
  ".cs",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sql",
  ".graphql",
  ".vue",
  ".svelte",
]);

const isCI = Boolean(process.env.CI);

// -- Triage setup --
// Warlock triages its matches with the PostHog AI gateway's decision model,
// which scores each flagged hit as a threat or not (POST /v1/systemone).
//
// Auth is a pre-issued gateway bearer read from the file named by
// CONTEXT_MILL_WARLOCK_GATEWAY_TOKEN_FILE (CI writes the secret there), the
// same mechanism the wizard's CI uses (WIZARD_CI_GATEWAY_TOKEN_FILE).
//   US: https://ai-gateway.us.posthog.com
//   EU: https://ai-gateway.eu.posthog.com
// WARLOCK_GATEWAY_URL / WARLOCK_GATEWAY_TOKEN override both for local runs.

function getGatewayUrl() {
  const host = process.env.POSTHOG_HOST || "https://us.posthog.com";
  let hostname = "";

  try {
    hostname = new URL(host).hostname.toLowerCase();
  } catch {
    try {
      hostname = new URL(`https://${host}`).hostname.toLowerCase();
    } catch {
      hostname = "";
    }
  }

  if (hostname === "eu.posthog.com" || hostname === "eu.i.posthog.com") {
    return "https://ai-gateway.eu.posthog.com";
  }
  return "https://ai-gateway.us.posthog.com";
}

function readGatewayToken() {
  if (process.env.WARLOCK_GATEWAY_TOKEN) return process.env.WARLOCK_GATEWAY_TOKEN;
  const tokenFile = process.env.CONTEXT_MILL_WARLOCK_GATEWAY_TOKEN_FILE;
  if (!tokenFile) return null;
  try {
    return fs.readFileSync(tokenFile, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function createClassifier() {
  const token = readGatewayToken();
  if (!token) return null;
  return createTriageClassifier({
    gatewayURL: process.env.WARLOCK_GATEWAY_URL || getGatewayUrl(),
    token,
  });
}

// Files triaged at once. Warlock keeps up to 4 decision requests in flight
// per file, so 2 files stay under the gateway's 10 requests per second.
const TRIAGE_CONCURRENCY = 2;

// One file per call: triage of a combined string sees only its first files' text.
async function triageEachFile(allMatches, classify) {
  const matchIndicesByFile = new Map();
  allMatches.forEach(({ label }, matchIndex) => {
    matchIndicesByFile.set(label, [...(matchIndicesByFile.get(label) ?? []), matchIndex]);
  });

  const triaged = new Array(allMatches.length);
  const filesToTriage = [...matchIndicesByFile.values()];
  async function triageRemainingFiles() {
    while (filesToTriage.length > 0) {
      const matchIndices = filesToTriage.shift();
      const fileResults = await triageMatches(
        allMatches[matchIndices[0]].content,
        matchIndices.map((matchIndex) => allMatches[matchIndex].match),
        classify,
      );
      matchIndices.forEach((matchIndex, j) => {
        triaged[matchIndex] = fileResults[j];
      });
    }
  }
  await Promise.all(Array.from({ length: TRIAGE_CONCURRENCY }, triageRemainingFiles));
  return triaged;
}

// -- Colors (disabled in CI where annotations do the work) --

const color = isCI
  ? {
      red: (s) => s,
      yellow: (s) => s,
      green: (s) => s,
      bold: (s) => s,
      dim: (s) => s,
    }
  : {
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
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
  const name = path.basename(zipPath, ".zip");
  const dest = path.join(tmpDir, name);
  fs.mkdirSync(dest, { recursive: true });
  try {
    execFileSync("unzip", ["-q", "-o", zipPath, "-d", dest], { stdio: "pipe" });
    return dest;
  } catch {
    console.warn(
      isCI
        ? `::warning::Failed to extract ${path.basename(zipPath)}`
        : `  Warning: failed to extract ${path.basename(zipPath)}, skipping`,
    );
    return null;
  }
}

function reportMatch(filePath, match, isFalsePositive = false) {
  const { rule, metadata } = match;
  const sev = metadata.severity || "unknown";
  const cat = metadata.category || "unknown";
  const triageReason = match.triage?.reason;

  if (isCI) {
    const level = isFalsePositive ? "warning" : "error";
    const tag = isFalsePositive ? "FALSE POSITIVE" : "THREAT DETECTED";
    console.log(
      `::${level} file=${filePath}::${tag} [${sev}] ${rule}: ${metadata.description || ""}`,
    );
  }

  const label = isFalsePositive
    ? `  ${color.yellow(color.bold("FALSE POSITIVE"))}  [${color.yellow(sev)}] ${cat}`
    : `  ${color.red(color.bold("THREAT DETECTED"))}  [${color.red(sev)}] ${cat}`;
  console.log(label);
  console.log(`  ${color.dim("Rule:")}     ${rule}`);
  console.log(`  ${color.dim("File:")}     ${filePath}`);
  if (metadata.description)
    console.log(`  ${color.dim("Why:")}      ${metadata.description}`);
  if (triageReason) console.log(`  ${color.dim("Triage:")}   ${triageReason}`);
  if (metadata.remediation)
    console.log(`  ${color.dim("Fix:")}      ${metadata.remediation}`);
  if (metadata.action)
    console.log(`  ${color.dim("Action:")}   ${metadata.action}`);
  console.log("");
}

// -- PostHog tracking --
// Sends scan results to PostHog via the public webhook (same one used by e2e tests).
// Fire-and-forget: tracking failures never block the scan result.

const POSTHOG_WEBHOOK_URL =
  "https://webhooks.us.posthog.com/public/webhooks/019a7a81-7961-0000-d3e3-b5f34cc2a32b";

async function trackScanResult({ filesScanned, yaraMatches, threats, falsePositives, result, llmTriageEnabled, durationMs, triaged }) {
  // Build per-rule breakdown: { ruleName: { true_positive: N, false_positive: N } }
  const rulesByVerdict = {};
  if (triaged) {
    for (const match of triaged) {
      const rule = match.rule;
      const verdict = match.triage?.verdict || "unknown";
      if (!rulesByVerdict[rule]) rulesByVerdict[rule] = { true_positive: 0, false_positive: 0 };
      if (verdict === "true_positive" || verdict === "false_positive") {
        rulesByVerdict[rule][verdict]++;
      }
    }
  }

  const rulesTriggered = Object.keys(rulesByVerdict);

  const payload = {
    event: "warlock_scan_completed",
    files_scanned: filesScanned,
    yara_matches: yaraMatches,
    threats,
    false_positives: falsePositives,
    result,
    llm_triage_enabled: llmTriageEnabled,
    triage_model: llmTriageEnabled ? TRIAGE_MODEL_ID : "",
    duration_ms: durationMs,
    rules_triggered: rulesTriggered,
    rules_by_verdict: rulesByVerdict,
    // CI context (empty strings when running locally)
    commit_sha: process.env.GITHUB_SHA || "",
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "",
    pr_number: process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)/)?.[1] || "",
    workflow_name: process.env.GITHUB_WORKFLOW || "",
    run_url: process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : "",
  };

  try {
    await fetch(POSTHOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Tracking is best-effort — never block the scan
  }
}

// -- Main --

async function main() {
  const startTime = Date.now();
  const classify = createClassifier();

  if (classify) {
    console.log(`Triage enabled (${TRIAGE_MODEL_ID} on the PostHog gateway).\n`);
  } else {
    console.log(
      "Triage disabled (no gateway token configured). All matches will be treated as threats.\n",
    );
  }

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage:");
    console.log(
      "  node scripts/scan-warlock.js dist/skills       # Scan built skill ZIPs",
    );
    console.log(
      "  node scripts/scan-warlock.js path/to/file.md   # Scan specific file(s)",
    );
    process.exit(1);
  }

  // Determine what to scan
  let filesToScan = []; // { label: string, filePath: string }
  let tmpDir = null;

  const firstArg = args[0];
  const isSingleDir =
    args.length === 1 &&
    fs.existsSync(firstArg) &&
    fs.statSync(firstArg).isDirectory();

  if (isSingleDir) {
    const dir = firstArg;
    const zips = fs.readdirSync(dir).filter((f) => f.endsWith(".zip"));

    if (zips.length > 0) {
      // ZIP mode: extract and scan each archive
      console.log(`Scanning ${zips.length} skill archive(s) with Warlock...\n`);
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "warlock-scan-"));
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
      console.log(
        `Scanning ${files.length} file(s) in ${dir} with Warlock...\n`,
      );
      for (const f of files) {
        filesToScan.push({
          label: path.relative(process.cwd(), f),
          filePath: f,
        });
      }
    }
  } else {
    // Individual files mode
    for (const arg of args) {
      if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
        filesToScan.push({
          label: path.relative(process.cwd(), arg),
          filePath: arg,
        });
      } else {
        console.error(`File not found: ${arg}`);
      }
    }
    console.log(`Scanning ${filesToScan.length} file(s) with Warlock...\n`);
  }

  // Step 1: Run all YARA scans and collect matches
  const allMatches = []; // { label, match, content }

  for (const { label, filePath } of filesToScan) {
    const content = fs.readFileSync(filePath, "utf8");
    const scanResult = await scan(content);

    if (scanResult.matched) {
      for (const match of scanResult.matches) {
        allMatches.push({ label, match, content });
      }
    }
  }

  console.log(
    `YARA scan complete: ${allMatches.length} match(es) across ${filesToScan.length} file(s).\n`,
  );

  // Step 2: Triage each file's matches against that file's own content
  let threats = 0;
  let warnings = 0;
  let triagedMatches = [];

  if (allMatches.length > 0) {
    triagedMatches = classify
      ? await triageEachFile(allMatches, classify)
      : allMatches.map(({ match }) => ({
          ...match,
          triage: {
            verdict: "true_positive",
            reason: "No triage available.",
          },
        }));

    for (let i = 0; i < triagedMatches.length; i++) {
      const { label } = allMatches[i];
      const match = triagedMatches[i];
      const isFP = match.triage.verdict === "false_positive";
      reportMatch(label, match, isFP);
      if (isFP) {
        warnings++;
      } else {
        threats++;
      }
    }
  }

  // Cleanup
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });

  const durationMs = Date.now() - startTime;
  const result = threats > 0 ? "fail" : "pass";

  // Track results in PostHog
  await trackScanResult({
    filesScanned: filesToScan.length,
    yaraMatches: allMatches.length,
    threats,
    falsePositives: warnings,
    result,
    llmTriageEnabled: Boolean(classify),
    durationMs,
    triaged: triagedMatches,
  });

  // Summary
  console.log("---");
  if (warnings > 0) {
    console.log(
      color.yellow(
        `${warnings} false positive(s) identified by triage (not blocking).`,
      ),
    );
  }
  if (threats > 0) {
    console.log(color.red(`FAILED: ${threats} threat(s) detected.`));
    console.log("Fix the flagged content before releasing.");
    process.exit(1);
  } else {
    console.log(
      color.green(`PASSED: No threats found in ${filesToScan.length} file(s).`),
    );
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Scan failed:", err);
  process.exit(2);
});
