#!/usr/bin/env -S npx tsx
/**
 * Check for large functions/classes in src/ that may cause merge conflicts.
 *
 * Implements Phase 15.5 CI-04 (v3.2): large-function-detector
 * Source: skills/upstream-merge/SKILL.md §6.6 rule 2 + retrospective §1.3
 *
 * Rationale: The 2026-07-01 first merge attempt had a `createMcpAdapter`
 * (then in the now-retired `adapters/entry.ts`) at 324 lines — both fork and
 * upstream modified the same function body, causing the hardest conflict.
 * Post fork-host, the same risk lives in upstream-managed core (e.g.
 * `index.ts` `installMcpAdapter`); detecting large functions before they
 * become merge-conflict sources still prevents future pain.
 *
 * Threshold: --max-lines (default 300)
 *
 * Usage:
 *   tsx scripts/check-large-functions.ts
 *   tsx scripts/check-large-functions.ts --max-lines 250
 *   tsx scripts/check-large-functions.ts --path src/ --json
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

interface FunctionInfo {
  file: string;
  name: string;
  startLine: number;
  endLine: number;
  lineCount: number;
}

interface Finding {
  file: string;
  function: string;
  startLine: number;
  endLine: number;
  lineCount: number;
  overage: number; // lineCount - maxLines
}

interface CliOptions {
  maxLines: number;
  path: string;
  json: boolean;
  exclude: string[];
}

const DEFAULT_EXCLUDE = ["__tests__", ".test.ts", ".test.tsx", "node_modules", "dist", "build", ".git", ".planning", "skills", "examples"];

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    maxLines: 300,
    path: ".",
    json: false,
    exclude: [...DEFAULT_EXCLUDE],
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--max-lines":
        opts.maxLines = parseInt(args[++i], 10);
        break;
      case "--path":
        opts.path = args[++i];
        break;
      case "--json":
        opts.json = true;
        break;
      case "--exclude":
        opts.exclude = args[++i].split(",");
        break;
      default:
        console.error(`Unknown arg: ${arg}`);
        process.exit(2);
    }
  }
  return opts;
}

function shouldExclude(filePath: string, exclude: string[]): boolean {
  return exclude.some((pattern) => filePath.includes(pattern));
}

function* walkFiles(dir: string): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walkFiles(full);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      yield full;
    }
  }
}

interface OpenBrace {
  char: string; // '{' | '('
  line: number;
}

/**
 * Find functions/classes with body length > maxLines.
 * Strategy: find declaration line, then find its body's first `{`, then
 * brace-count to find the matching `}`. Multi-line signatures are common
 * in TypeScript, so we don't limit how far ahead the `{` can be.
 */
function findLargeFunctions(filePath: string, maxLines: number): FunctionInfo[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const results: FunctionInfo[] = [];

  // Match function/class/exported const declarations at line start
  const fnStartRegex = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^export\s+class\s+([A-Za-z_$][\w$]*)|^export\s+const\s+([A-Za-z_$][\w$]*)\s*[=:]/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(fnStartRegex);
    if (match) {
      const name = match[1] || match[2] || match[3];

      // Find the first `{` from this line forward (no limit — signatures can span 10+ lines)
      let openBraceLine = -1;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes("{")) {
          openBraceLine = j;
          break;
        }
      }

      if (openBraceLine === -1) {
        // No `{` found — declaration without body (interface/type); skip
        i++;
        continue;
      }

      // From openBraceLine, count braces to find matching `}`
      let depth = 0;
      let closeBraceLine = -1;
      let foundOpen = false;
      for (let j = openBraceLine; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === "{") {
            depth++;
            foundOpen = true;
          } else if (ch === "}") {
            depth--;
            if (foundOpen && depth === 0) {
              closeBraceLine = j;
              break;
            }
          }
        }
        if (foundOpen && depth === 0) break;
      }

      if (closeBraceLine === -1) {
        // Unclosed brace (syntax error); skip
        i++;
        continue;
      }

      const lineCount = closeBraceLine - i + 1;
      if (lineCount > maxLines) {
        results.push({
          file: filePath,
          name,
          startLine: i + 1, // 1-indexed
          endLine: closeBraceLine + 1,
          lineCount,
        });
      }

      i = closeBraceLine + 1; // continue scanning after this function
      continue;
    }
    i++;
  }

  return results;
}

function main() {
  const opts = parseArgs();
  const findings: Finding[] = [];

  try {
    const stat = statSync(opts.path);
    if (!stat.isDirectory()) {
      console.error(`Path is not a directory: ${opts.path}`);
      process.exit(2);
    }
  } catch (e) {
    console.error(`Cannot access path: ${opts.path}`);
    process.exit(2);
  }

  for (const file of walkFiles(opts.path)) {
    if (shouldExclude(file, opts.exclude)) continue;
    const funcs = findLargeFunctions(file, opts.maxLines);
    for (const f of funcs) {
      findings.push({
        file: relative(process.cwd(), f.file),
        function: f.name,
        startLine: f.startLine,
        endLine: f.endLine,
        lineCount: f.lineCount,
        overage: f.lineCount - opts.maxLines,
      });
    }
  }

  if (opts.json) {
    const output = {
      max_lines: opts.maxLines,
      path: opts.path,
      total_findings: findings.length,
      findings: findings.sort((a, b) => b.lineCount - a.lineCount),
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[large-function-check] scanning ${opts.path} (max-lines=${opts.maxLines})`);
    if (findings.length === 0) {
      console.log(`✅ PASS: no functions > ${opts.maxLines} lines`);
    } else {
      console.log(`⚠️  WARNING: ${findings.length} large function(s) found:`);
      for (const f of findings) {
        console.log(
          `  - ${f.file}:${f.startLine}-${f.endLine} ${f.function} (${f.lineCount} lines, +${f.overage} over)`,
        );
      }
      console.log("");
      console.log("⚠️  Large functions are merge-conflict risks (both fork and upstream");
      console.log("   modify the same body). Decompose BEFORE the next upstream merge.");
    }
  }

  // Don't fail the build (advisory per v3.1 §5(b) pattern)
  // But exit non-zero if findings exist AND --strict flag is set
  if (process.env["STRICT"] === "1" && findings.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
