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
 *   Auto-disabled in non-tty. Flags: `--no-color`, `--color` force on/off.
 *
 * GnuTLS workaround: copied verbatim from 08-LEARNINGS.md L-4 (do NOT re-derive):
 *   `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags`
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const LOG_PREFIX = "[divergence-check]";
const REGISTRY_PATH = resolve(
  dirname(new URL(import.meta.url).pathname),
  "../skills/upstream-merge/references/special-cases.md",
);
const DIFF_ARGS = ["diff", "upstream/main", "--name-status", "--", "*.ts", "*.md", "*.json"];

const argv = process.argv.slice(2);
const useColor =
  !argv.includes("--no-color") &&
  (argv.includes("--color") || process.stdout.isTTY === true);
const c = useColor
  ? { green: "\u001b[32m", yellow: "\u001b[33m", red: "\u001b[31m", reset: "\u001b[0m" }
  : { green: "", yellow: "", red: "", reset: "" };

function runGit(args: string[], envOverride?: Record<string, string>): string {
  return execFileSync("git", args, {
    encoding: "utf-8",
    env: { ...process.env, ...envOverride },
  });
}

function fetchUpstream(): void {
  try {
    runGit(["fetch", "upstream"]);
  } catch (err) {
    // GnuTLS workaround from 08-LEARNINGS.md L-4 (verbatim):
    //   GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags
    try {
      runGit(["-c", "http.sslVerify=false", "fetch", "upstream", "--tags"], { GIT_SSL_NO_VERIFY: "1" });
    } catch (err2) {
      console.error(`${LOG_PREFIX} FATAL: git fetch upstream failed (and GnuTLS workaround also failed): ${(err2 as Error).message}`);
      process.exit(2);
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
  fetchUpstream();
  const diff = parseDiff(runGit(DIFF_ARGS));
  const registry = parseRegistry();
  const { registered, divergedButNotRegistered, stale } = classify(diff, registry);

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
