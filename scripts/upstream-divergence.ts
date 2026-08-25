/**
 * scripts/upstream-divergence.ts — D-34 contract implementation
 *
 * Behavior (per D-34):
 *   1. Fetches `upstream/main` (with GnuTLS workaround from 08-LEARNINGS.md L-4 if the plain fetch fails)
 *   2. Cross-checks `git diff upstream/main --name-status -- '*.ts' '*.md' '*.json'` against
 *      `skills/upstream-merge/references/special-cases.md`
 *   3. Emits 3-category classification (registered / diverged-but-not-registered / stale) with ANSI color
 *   4. Exit codes: 0 = clean (no stale entries), 1 = stale entries present, 2 = fatal (fetch / parse failure)
 *
 * Color: GREEN (registered), YELLOW (diverged-but-not-registered), RED (stale / fatal).
 *   Auto-disabled in non-tty. Flags: `--no-color`, `--color` force on/off, `--base <ref>` overrides
 *   the comparison ref (default `upstream/main`).
 *
 * GnuTLS workaround: copied verbatim from 08-LEARNINGS.md L-4 (do NOT re-derive):
 *   `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags`
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOG_PREFIX = "[divergence-check]";
const REGISTRY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../skills/upstream-merge/references/special-cases.md",
);
const argv = process.argv.slice(2);
// IF-02: --base <ref> overrides the comparison ref (default: upstream/main).
const baseIdx = argv.indexOf("--base");
const baseRef = baseIdx > -1 && argv[baseIdx + 1] && !argv[baseIdx + 1].startsWith("--")
  ? argv[baseIdx + 1]
  : "upstream/main";
const DIFF_ARGS = ["diff", baseRef, "--name-status", "--", "*.ts", "*.md", "*.json"];
const useColor =
  !argv.includes("--no-color") &&
  (argv.includes("--color") || process.stdout.isTTY === true);
const c = useColor
  ? { green: "\u001b[32m", yellow: "\u001b[33m", red: "\u001b[31m", reset: "\u001b[0m" }
  : { green: "", yellow: "", red: "", reset: "" };
// CI-02 (Phase 15): --json emits machine-readable output for CI pipelines.
// JSON schema documented in docs/upstream-merge-retrospective.md §12 (appendix).
const jsonMode = argv.includes("--json");

function runGit(args: string[], envOverride?: Record<string, string>): string {
  return execFileSync("git", args, {
    encoding: "utf-8",
    env: { ...process.env, ...envOverride },
    maxBuffer: 64 * 1024 * 1024,
  });
}

function fetchUpstream(): boolean {
  try {
    runGit(["fetch", "upstream"]);
    return true;
  } catch (err) {
    // IF-03: log the first fetch error before attempting the GnuTLS workaround,
    // so the original error context is preserved if the workaround also fails.
    console.error(`${LOG_PREFIX} plain 'git fetch upstream' failed: ${(err as Error).message}; trying GnuTLS workaround (08-LEARNINGS.md L-4)`);
    // GnuTLS workaround from 08-LEARNINGS.md L-4 (verbatim):
    //   GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags
    try {
      runGit(["-c", "http.sslVerify=false", "fetch", "upstream", "--tags"], { GIT_SSL_NO_VERIFY: "1" });
      return true;
    } catch (err2) {
      console.error(`${LOG_PREFIX} upstream unreachable (plain + GnuTLS workaround both failed): ${(err2 as Error).message}`);
      return false;
    }
  }
}

function parseDiff(stdout: string): string[] {
  const out: string[] = [];
  for (const line of stdout.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const status = parts[0];
    // R and C have 3 columns; use the destination column for these.
    const path = (status.startsWith("R") || status.startsWith("C")) ? parts[2] : parts[1];
    const trimmed = path?.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

function parseRegistry(): Set<string> {
  let text: string;
  try {
    text = readFileSync(REGISTRY_PATH, "utf-8");
  } catch (err) {
    console.error(`${LOG_PREFIX} FATAL: cannot read registry at ${REGISTRY_PATH}: ${(err as Error).message}`);
    process.exit(2);
  }
  const lines = text.split("\n");
  const matches = text.matchAll(/^\| `([^`]+)` \|/gm);
  const paths = new Set<string>();
  for (const m of matches) paths.add(m[1]);
  // Warn on rows that look like registry entries (start with `| `) but failed to parse.
  const malformed = lines.filter((l) => /^\| /.test(l) && !/^\| `[^`]+` \|/.test(l) && !/^\|\s*-+\s*\|/.test(l));
  for (const m of malformed) console.warn(`${LOG_PREFIX} WARN: registry row not parsed (skipped): ${m}`);
  if (paths.size === 0) {
    console.error(`${LOG_PREFIX} FATAL: registry parse produced 0 entries from ${REGISTRY_PATH}`);
    process.exit(2);
  }
  return paths;
}

function classify(diffPaths: string[], registry: Set<string>): {
  registered: string[];
  divergedButNotRegistered: string[];
  stale: string[];
} {
  const diff = new Set(diffPaths);
  const registered: string[] = [];
  const divergedButNotRegistered: string[] = [];
  const stale: string[] = [];
  for (const p of [...diff].sort()) (registry.has(p) ? registered : divergedButNotRegistered).push(p);
  for (const p of [...registry].sort()) if (!diff.has(p)) stale.push(p);
  return { registered, divergedButNotRegistered, stale };
}

function main(): void {
  if (!fetchUpstream()) {
    // Upstream unreachable (runner network) — the workflow's own intent is to
    // skip the check in this case (see pr-divergence-check.yml "check skipped").
    // Emit valid, machine-readable output and exit 0 so the CI comment step
    // does not JSON.parse() an empty file.
    if (jsonMode) {
      console.log(JSON.stringify({
        upstream_ref: baseRef,
        skipped: true,
        reason: "upstream fetch failed (env network); check skipped",
        diverged_count: 0,
        registered: [],
        diverged_but_not_registered: [],
        stale: [],
        default_resolved_by_category: 0,
        exit_code: 0,
      }, null, 2));
    } else {
      console.log(`${LOG_PREFIX} upstream unreachable — skipping divergence check (exit 0)`);
    }
    process.exit(0);
  }
  const diff = parseDiff(runGit(DIFF_ARGS));
  const registry = parseRegistry();
  const { registered, divergedButNotRegistered, stale } = classify(diff, registry);

  // CI-02 (Phase 15): JSON output mode for CI pipelines.
  // hunk_independence is NOT predicted here (requires in-flight conflict markers).
  // Run SKILL.md §3.5 awk script during merge conflict for 4-category classification.
  if (jsonMode) {
    const output = {
      upstream_ref: baseRef,
      diverged_count: diff.length,
      registered,
      diverged_but_not_registered: divergedButNotRegistered,
      stale,
      default_resolved_by_category: divergedButNotRegistered.length,
      exit_code: stale.length > 0 ? 1 : 0,
      hunk_independence_note:
        "Run SKILL.md §3.5 awk script during merge conflict for 4-category classification (different-function / same-function-different-section / same-function-same-section / import-region)",
      schema_version: "1.0",
      schema_documented_in: "docs/upstream-merge-retrospective.md §12 (appendix)",
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(stale.length > 0 ? 1 : 0);
  }

  console.log(`${LOG_PREFIX} upstream ref: main, scanned ${diff.length} files`);
  console.log(`${c.green}✓ registered (${registered.length}):${c.reset}`);
  for (const p of registered) console.log(`   ${p}`);
  console.log(
    `${c.yellow}⚠ diverged-but-not-registered (${divergedButNotRegistered.length}): [category: assess]${c.reset}`,
  );
  for (const p of divergedButNotRegistered) console.log(`   ${p}`);
  console.log(
    `${c.red}✗ stale (registry entry no longer diverged) (${stale.length}):${c.reset}`,
  );
  for (const p of stale) console.log(`   ${p}`);
  console.log(
    `${LOG_PREFIX} summary: ${diff.length} diverged, ${registered.length} registered, ${divergedButNotRegistered.length} default-resolved by category, ${stale.length} stale`,
  );
  console.log(`${LOG_PREFIX} exit: ${stale.length > 0 ? 1 : 0}${stale.length > 0 ? " (stale entries require manual review)" : ""}`);
  process.exit(stale.length > 0 ? 1 : 0);
}

void main();
