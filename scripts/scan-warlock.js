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

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const os = require("node:os");
const Anthropic = require("@anthropic-ai/sdk");

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".yaml",
  ".yml",
  ".json",
  ".js",
  ".ts",
  ".py",
  ".rb",
  ".sh",
]);

const isCI = Boolean(process.env.CI);

// -- LLM triage setup --
// Uses the PostHog LLM gateway to triage warlock
// matches. The LLM decides whether each match is a real threat or a
// false positive
//
// Gateway URL pattern matches the wizard:
//   US:    https://gateway.us.posthog.com/wizard
//   EU:    https://gateway.eu.posthog.com/wizard
//   Local: http://localhost:3308/wizard

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

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "http://localhost:3308/wizard";
  }
  if (hostname === "eu.posthog.com" || hostname === "eu.i.posthog.com") {
    return "https://gateway.eu.posthog.com/wizard";
  }
  return "https://gateway.us.posthog.com/wizard";
}

function createLLMProvider() {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({
    baseURL: getGatewayUrl(),
    apiKey,
  });

  return async (prompt) => {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16384,
      messages: [{ role: "user", content: prompt }],
    });
    return res.content[0].text;
  };
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

// -- Main --

async function main() {
  const { scan, triageMatches } = require("@posthog/warlock");
  const llmProvider = createLLMProvider();

  if (llmProvider) {
    console.log("LLM triage enabled (using PostHog gateway).\n");
  } else {
    console.log(
      "LLM triage disabled (no POSTHOG_API_KEY set). Matches will be treated as threats.\n",
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
    const result = await scan(content);

    if (result.matched) {
      for (const match of result.matches) {
        allMatches.push({ label, match, content });
      }
    }
  }

  console.log(
    `YARA scan complete: ${allMatches.length} match(es) across ${filesToScan.length} file(s).\n`,
  );

  // Step 2: Triage ALL matches in one LLM call
  let threats = 0;
  let warnings = 0;

  if (allMatches.length > 0) {
    const rawMatches = allMatches.map((m) => m.match);

    // Build a combined content summary for the LLM (one snippet per unique file)
    const uniqueFiles = new Map();
    for (const { label, content } of allMatches) {
      if (!uniqueFiles.has(label)) {
        uniqueFiles.set(label, content);
      }
    }
    const MAX_COMBINED_CHARS = 100_000;
    let combinedContent = "";
    for (const [label, content] of uniqueFiles.entries()) {
      const snippet = `--- ${label} ---\n${content.slice(0, 2000)}\n\n`;
      if (combinedContent.length + snippet.length > MAX_COMBINED_CHARS) break;
      combinedContent += snippet;
    }

    const triaged = llmProvider
      ? await triageMatches(combinedContent, rawMatches, llmProvider)
      : rawMatches.map((m) => ({
          ...m,
          triage: {
            verdict: "true_positive",
            reason: "No LLM triage available.",
          },
        }));

    for (let i = 0; i < triaged.length; i++) {
      const { label } = allMatches[i];
      const match = triaged[i];
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

  // Summary
  console.log("---");
  if (warnings > 0) {
    console.log(
      color.yellow(
        `${warnings} false positive(s) identified by LLM triage (not blocking).`,
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
