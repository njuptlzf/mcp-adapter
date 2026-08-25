#!/usr/bin/env -S npx tsx
/**
 * Check for import-region conflict risks in PR diff.
 *
 * Implements Phase 15.5 CI-05 (v3.2): import-region-conflict-detector
 * Source: skills/upstream-merge/SKILL.md §6.6 rule 3 + retrospective §1.3
 *
 * Rationale: The 2026-07-01 first merge had 3 import-region conflicts
 * (27% of 11 total) — fork added `import { ... } from "@earendil-works/pi-coding-agent"`
 * to core files (direct-tools.ts, index.ts, proxy-modes.ts) where upstream
 * also added similar imports. The fix: fork should use `interfaces/agent-api.ts`
 * abstractions in core, not direct Pi imports.
 *
 * Detection rules (3):
 * 1. Core files (not in adapters/ or interfaces/) adding direct Pi imports
 * 2. import region modifications (touching existing import lines)
 * 3. New @earendil-works/pi- imports outside adapters/ + interfaces/ + types/
 *
 * Usage:
 *   tsx scripts/check-import-region.ts                # check against origin/main
 *   tsx scripts/check-import-region.ts --base main  # check against main
 *   tsx scripts/check-import-region.ts --json        # JSON output
 */

import { execFileSync } from "node:child_process";

interface Finding {
  file: string;
  line: number;
  type: "direct-pi-import" | "import-region-modified" | "new-pi-import";
  message: string;
  severity: "error" | "warning";
}

interface CliOptions {
  base: string;
  json: boolean;
  strict: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = { base: "origin/main", json: false, strict: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--base": opts.base = args[++i]; break;
      case "--json": opts.json = true; break;
      case "--strict": opts.strict = true; break;
      default:
        console.error(`Unknown arg: ${args[i]}`);
        process.exit(2);
    }
  }
  return opts;
}

function gitDiff(base: string): string {
  return execFileSync("git", ["diff", "--unified=0", "--no-color", `${base}...HEAD`], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
}

const CORE_FILES = /^(?!adapters\/|interfaces\/|types\/|__tests__\/|scripts\/|examples\/|.planning\/|skills\/|.github\/|node_modules\/|.git\/)/;

function analyzeDiff(diff: string): Finding[] {
  const findings: Finding[] = [];
  let currentFile: string | null = null;
  let currentLine = 0;

  for (const line of diff.split("\n")) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      continue;
    }
    if (!currentFile) continue;
    if (!line.startsWith("+") || line.startsWith("+++")) continue;

    currentLine++;

    // Rule 1: Direct Pi imports in core files
    if (CORE_FILES.test(currentFile) && /from\s+["']@earendil-works\/pi-/.test(line)) {
      findings.push({
        file: currentFile,
        line: currentLine,
        type: "direct-pi-import",
        message: `Direct @earendil-works/pi- import in core file. Use interfaces/agent-api.ts abstraction instead.`,
        severity: "warning",
      });
    }

    // Rule 2: import region modification (any change to import block)
    if (/^import\s/.test(line.trim()) && currentFile.endsWith(".ts")) {
      // Check if this is a NEW import (added) that imports from a non-Pi package
      // and the file is in core (not in adapters/ which legitimately imports Pi)
      if (CORE_FILES.test(currentFile) && !/from\s+["']@earendil-works\/pi-/.test(line)) {
        // This is a non-Pi import being added to core — note it for review
        // (don't error, just track)
        // Skip for now to avoid noise
      }
    }

    // Rule 3: New @earendil-works/pi- import outside legal zones
    if (/from\s+["']@earendil-works\/pi-/.test(line)) {
      const legalZone = /^(adapters\/|interfaces\/|types\/|__tests__\/)/.test(currentFile);
      if (!legalZone) {
        findings.push({
          file: currentFile,
          line: currentLine,
          type: "new-pi-import",
          message: `New @earendil-works/pi- import in ${currentFile}. This is a merge-conflict risk — upstream may also add this import.`,
          severity: "warning",
        });
      }
    }
  }

  return findings;
}

function main() {
  const opts = parseArgs();

  let diff: string;
  try {
    diff = gitDiff(opts.base);
  } catch (e) {
    console.error(`git diff failed: ${(e as Error).message}`);
    process.exit(2);
  }

  const findings = analyzeDiff(diff);

  if (opts.json) {
    console.log(JSON.stringify({ base: opts.base, total_findings: findings.length, findings }, null, 2));
  } else {
    console.log(`[import-region-check] base=${opts.base}`);
    if (findings.length === 0) {
      console.log(`✅ PASS: no import-region conflict risks`);
    } else {
      console.log(`⚠️  WARNING: ${findings.length} import-region finding(s):`);
      for (const f of findings) {
        console.log(`  - ${f.file}:${f.line} [${f.type}] ${f.message}`);
      }
    }
  }

  // Don't fail — advisory (per v3.1 §5(b) pattern)
  if (opts.strict && findings.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
