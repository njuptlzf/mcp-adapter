---
phase: 09-upstream-manifest-architecture-c
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - package.json
  - scripts/upstream-divergence.ts
  - skills/upstream-merge/SKILL.md
  - skills/upstream-merge/references/special-cases.md
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the four files that replace the 209-row `UPSTREAM-CHANGES.md` manifest with Architecture C (special-cases-only registry + 12-category default-resolution matrix). The TypeScript divergence-check script `scripts/upstream-divergence.ts` is generally well-structured (synchronous `execFileSync`, defensive Set-based classification, TTY-aware ANSI), but contains one Critical defect (the script's comment falsely claims it copies the GnuTLS workaround "verbatim from 08-LEARNINGS.md L-4" while silently dropping the documented `--tags` flag), four Warnings (rename/copy status handling, missing-file error path, two documentation inconsistencies between SKILL.md and special-cases.md), and three Info items (an unused decision value, a hardcoded ref name, and a swallowed first-error message).

The script's exit-code contract (0=no stale, 1=stale, 2=fatal) matches its own comment and SKILL.md §2; the orchestrator prompt description in the task brief was inverted relative to the actual implementation, but the code is internally consistent.

## Critical Issues

### CR-01: Script comment falsely claims "copied verbatim from 08-LEARNINGS.md L-4" — `--tags` flag is dropped

**File:** `scripts/upstream-divergence.ts:14-15` and `scripts/upstream-divergence.ts:51`

**Issue:** The JSDoc comment at lines 14–15 explicitly states:

> ```
> GnuTLS workaround: copied verbatim from 08-LEARNINGS.md L-4 (do NOT re-derive):
>   `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream`
> ```

But the **actual** workaround documented in `08-LEARNINGS.md` L-4 (line 208 of that file) is:

> `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags`

The script's implementation on line 51 (`runGit(["-c", "http.sslVerify=false", "fetch", "upstream"], { GIT_SSL_NO_VERIFY: "1" })`) and the in-comment example both omit `--tags`. The comment's "copied verbatim (do NOT re-derive)" claim is verifiable false, and the orchestrator brief explicitly framed the implementation as "copied from 08-LEARNINGS.md L-4." Future maintainers will trust the comment, propagate the dropped `--tags`, and lose upstream tag refs (relevant for any v2.10+ version-aware workflow).

**Evidence:**
- LEARNINGS.md L-4 (authoritative source): `git fetch upstream --tags` — includes `--tags`.
- Script line 51: `["-c", "http.sslVerify=false", "fetch", "upstream"]` — no `--tags`.
- SKILL.md line 30 (cross-referenced by the script) also drops `--tags`, so the inconsistency exists in two places.

**Fix:** Either add `--tags` to the script (and SKILL.md §1) to match L-4, or change the script's comment to honestly say "adapted from 08-LEARNINGS.md L-4; `--tags` intentionally omitted (not needed for path-level diff)." Recommended: add `--tags` — it is the authoritative command and costs nothing.

```typescript
// Recommended fix at scripts/upstream-divergence.ts:51:
runGit(["-c", "http.sslVerify=false", "fetch", "upstream", "--tags"], { GIT_SSL_NO_VERIFY: "1" });
// And update the comment on line 15 to include `--tags`.
```

## Warnings

### WR-01: `parseDiff` extracts the wrong column for rename/copy (R/C) status codes

**File:** `scripts/upstream-divergence.ts:59-65`

**Issue:** `git diff --name-status` outputs 3-column rows for renames and copies:

```
R100\told_path\tnew_path
C075\tsource_path\tdest_path
```

The script unconditionally takes `l.split("\t")[1]?.trim()`, which for R/C rows yields the **old** (or source) path. The registry (`special-cases.md`) stores paths as they exist in the working tree (the **new** / dest path). Result: when upstream renames a tracked file, the diff row's column 1 won't match the registry entry, the registry entry will be reported as "stale," and the new-name path will appear in the diverged-but-not-registered list — a false-positive in both categories simultaneously.

Edge case (renames are rare in this fork), but the false-positive has misleading semantics (the file IS registered, just under its new name).

**Fix:** Branch on the status prefix:

```typescript
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
```

### WR-02: `parseRegistry` does not catch `readFileSync` failures — exit code is non-2, not the documented "fatal"

**File:** `scripts/upstream-divergence.ts:67-77`

**Issue:** The SKILL.md §2 (line 60) promises:

> Exit 2 — fatal: `git fetch upstream` failed AND the GnuTLS workaround also failed, **OR the registry parse produced 0 entries**.

But `readFileSync` is not wrapped in try/catch. If `skills/upstream-merge/references/special-cases.md` is missing or unreadable, Node.js throws an uncaught `ENOENT` / `EACCES`, the script exits with a non-zero code (typically 1), **not 2**. The SKILL.md documentation is therefore incomplete — missing-file is a different exit code than 0-entries.

Also affects users who run the script from a different cwd or in a CI environment where the registry path doesn't resolve as expected (the `import.meta.url` + `resolve` approach is robust, but symlink-heavy CI setups can still surprise).

**Fix:** Wrap the read in try/catch:

```typescript
function parseRegistry(): Set<string> {
  let text: string;
  try {
    text = readFileSync(REGISTRY_PATH, "utf-8");
  } catch (err) {
    console.error(`${LOG_PREFIX} FATAL: cannot read registry at ${REGISTRY_PATH}: ${(err as Error).message}`);
    process.exit(2);
  }
  // ... rest unchanged
}
```

### WR-03: SKILL.md fast-path summary contradicts the §3.2a 12-category matrix on `interfaces/*` and is missing `types/pi-*.d.ts`

**File:** `skills/upstream-merge/SKILL.md:79-86` (fast-path) vs. `skills/upstream-merge/SKILL.md:134-147` (matrix)

**Issue:** The two summaries are supposed to be consistent (per §3.2a's own claim of being "the same logic visible in one place"), but they disagree in three places:

| File / category | Fast-path (§3 decision tree, lines 79–86) | 12-category matrix (§3.2a, lines 134–147) |
|---|---|---|
| `interfaces/agent-api.ts`, `interfaces/agent-paths.ts`, `interfaces/sampling.ts` | "**`ours` + manual review**" — internally contradictory (`ours` means `--ours`, `manual` means line-by-line review) | `interfaces/*` → **`manual`** |
| `.gitignore`, `.npmignore` | `manual` | **Not mentioned** (silent gap) |
| `.claude/*` | `ours` | **Not mentioned** (silent gap) |
| `types/pi-*.d.ts` | **Not mentioned** | `ours` |
| `types.ts` / `utils.ts` / `errors.ts` / `logger.ts` | (implicit in "Core MCP source") | Explicit `assess` |

The fast-path's "ours + manual review" phrasing is especially harmful — `--ours` and line-by-line manual review are mutually exclusive actions; a maintainer following the fast-path doesn't know which one to apply. The matrix (and the registry entries for `interfaces/agent-api.ts` etc., which all list `manual`) is the correct one.

**Fix:** Replace the fast-path bullet at line 82 with:

```markdown
- `interfaces/*` (agent-api.ts, agent-paths.ts, sampling.ts, etc.) → **`manual`** (line-by-line; upstream remains Pi-specific per D-01..D-03).
```

And add `types/pi-*.d.ts` and `.claude/*` and `.gitignore` / `.npmignore` rows to the fast-path so it stops diverging from the matrix.

### WR-04: `special-cases.md` claims malformed rows trigger exit 2 — but they are silently dropped

**File:** `skills/upstream-merge/references/special-cases.md:33`

**Issue:** Line 33 promises:

> a malformed row will surface as exit 2

But the script's `parseRegistry` only exits 2 when the **total parsed set is empty**. A single malformed row (e.g., a path missing backticks, a typo, an unescaped `|` in the `Why special` column) is silently filtered out by the regex `/^\| `([^`]+)` \|/gm` and never added to the set. The script then either (a) classifies the corresponding working-tree file as "diverged-but-not-registered" (false positive — file IS supposed to be registered), or (b) silently marks a correct entry as stale if it happens to be missing from the diff.

This is a robustness gap that the documentation actively misrepresents, so future maintainers adding rows will assume broken syntax is caught.

**Fix (two options):**

1. **Update the doc** to be honest:

   ```markdown
   Append a row using the exact schema `| `path` | `status` | `why` | `decision` |`.
   After adding, run `npm run upstream:check --no-color` and visually verify the new
   path appears in the `✓ registered` section (not in `⚠ diverged-but-not-registered`,
   which would indicate the registry did not recognise the row).
   ```

2. **Or strengthen the parser** to detect malformed rows and warn:

   ```typescript
   const lines = text.split("\n");
   const matches = text.matchAll(/^\| `([^`]+)` \|/gm);
   const paths = new Set<string>();
   for (const m of matches) paths.add(m[1]);
   // Warn on rows that look like registry entries (start with `| `) but failed to parse.
   const malformed = lines.filter((l) => /^\| /.test(l) && !/^\| `[^`]+` \|/.test(l) && !/^\|\s*-+\s*\|/.test(l));
   for (const m of malformed) console.warn(`${LOG_PREFIX} WARN: registry row not parsed (skipped): ${m}`);
   ```

   Recommended: do **both** — parser hardening + corrected doc.

## Info

### IF-01: `wraps-theirs` decision value is documented but unused by any of the 17 entries

**File:** `skills/upstream-merge/references/special-cases.md:29`

**Issue:** Line 29 lists 4 decision values: `ours` / `manual` / `assess` / `wraps-theirs`. The 17 anchored entries use only `ours` (×5), `assess` (×6), and `manual` (×6) — `wraps-theirs` is documented but has no exemplar. `wraps-theirs` is semantically close to the §3.2b "accept upstream + follow-up commit" pattern, so its absence may be intentional, but the 5-value taxonomy isn't load-bearing without an example.

**Fix:** Either drop `wraps-theirs` from the documentation (since no current entry uses it and the §3.2b flow already covers the semantics) or add a note explaining when it should be used, e.g.:

```markdown
**Decision values** (4): `ours` / `manual` / `assess` / `wraps-theirs`.
`wraps-theirs` is reserved for entries where the §3.2b follow-up flow applies
immediately and is recorded in the registry up-front (currently no entries use it;
the §3.2b flow is invoked at merge time, not at registry-write time).
```

### IF-02: `upstream/main` is hardcoded — no `--base <ref>` flag

**File:** `scripts/upstream-divergence.ts:27`

**Issue:** `DIFF_ARGS` hardcodes `upstream/main` as the comparison ref. If the upstream remote uses `master` instead of `main` (or a user wants to compare against a specific upstream tag, e.g. `upstream/v2.10.0`), the script silently produces the wrong diff. No CLI flag is exposed to override the base ref.

**Fix:** Add a `--base <ref>` flag (default `upstream/main`):

```typescript
const baseIdx = argv.indexOf("--base");
const baseRef = baseIdx > -1 && argv[baseIdx + 1] ? argv[baseIdx + 1] : "upstream/main";
const DIFF_ARGS = ["diff", baseRef, "--name-status", "--", "*.ts", "*.md", "*.json"];
```

### IF-03: First fetch error message is swallowed when both fetches fail

**File:** `scripts/upstream-divergence.ts:44-57`

**Issue:** `fetchUpstream` captures the first error in `err` but only logs `err2` when the workaround also fails:

```typescript
} catch (err) {
  try {
    runGit(["-c", "http.sslVerify=false", "fetch", "upstream"], { GIT_SSL_NO_VERIFY: "1" });
  } catch (err2) {
    console.error(`${LOG_PREFIX} FATAL: git fetch upstream failed (and GnuTLS workaround also failed): ${(err2 as Error).message}`);
    process.exit(2);
  }
}
```

When both fail, the user sees only the GnuTLS-workaround error (typically a TLS handshake failure with the same root cause as the first), losing the original error context that might point to a different root cause (e.g. "no such remote 'upstream'" before the TLS failure).

**Fix:** Log both, or log the first error when it occurs:

```typescript
} catch (err) {
  console.error(`${LOG_PREFIX} plain 'git fetch upstream' failed: ${(err as Error).message}; trying GnuTLS workaround`);
  try {
    runGit(["-c", "http.sslVerify=false", "fetch", "upstream", "--tags"], { GIT_SSL_NO_VERIFY: "1" });
  } catch (err2) {
    console.error(`${LOG_PREFIX} FATAL: GnuTLS workaround also failed: ${(err2 as Error).message}`);
    process.exit(2);
  }
}
```

---

_Reviewed: 2026-06-22T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_