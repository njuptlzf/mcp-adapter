---
phase: 09-upstream-manifest-architecture-c
review_iteration: 1
fix_scope: critical_warning
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-06-22T10:55:00Z
**Source review:** `.planning/phases/09-upstream-manifest-architecture-c/09-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 Critical + 4 Warning)
- Fixed: 5
- Skipped: 0

## Per-finding summary

| ID | Title | Commit | Files modified |
|---|---|---|---|
| CR-01 | Add `--tags` to GnuTLS workaround | `bf82a91` | `scripts/upstream-divergence.ts`, `skills/upstream-merge/SKILL.md` |
| WR-01 | Handle rename/copy status in `parseDiff` | `77ef3ed` | `scripts/upstream-divergence.ts` |
| WR-02 | Wrap `parseRegistry` `readFileSync` in try/catch | `87e4e72` | `scripts/upstream-divergence.ts` |
| WR-03 | Align SKILL.md fast-path with §3.2a matrix | `a9d183d` | `skills/upstream-merge/SKILL.md` |
| WR-04 | Correct malformed-row semantics in special-cases.md | `dd21e2e` | `scripts/upstream-divergence.ts`, `skills/upstream-merge/references/special-cases.md` |

## Fixed Issues

### CR-01: Add `--tags` to GnuTLS workaround

**Files modified:** `scripts/upstream-divergence.ts`, `skills/upstream-merge/SKILL.md`
**Commit:** `bf82a91`
**Applied fix:**
- Updated JSDoc header (line 15) to include `--tags`.
- Updated `fetchUpstream` (line 51) to pass `"--tags"` in the `runGit` args array.
- Updated SKILL.md §1 GnuTLS workaround blockquote (line 30) and §2 exit-2 explanation (line 60) to include `--tags` and cite L-4.

Verbatim command now matches `08-LEARNINGS.md` L-4: `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags`.

### WR-01: Handle rename/copy status in `parseDiff`

**Files modified:** `scripts/upstream-divergence.ts`
**Commit:** `77ef3ed`
**Applied fix:** Rewrote `parseDiff` to branch on the status prefix — for `R*` (rename) and `C*` (copy) rows the destination column (`parts[2]`) is used instead of the source column (`parts[1]`). Otherwise behavior is unchanged.

### WR-02: Wrap `parseRegistry` `readFileSync` in try/catch

**Files modified:** `scripts/upstream-divergence.ts`
**Commit:** `87e4e72`
**Applied fix:** Wrapped `readFileSync(REGISTRY_PATH, "utf-8")` in try/catch. On failure the script logs `FATAL: cannot read registry at <path>: <err.message>` and exits with code 2 — matching the SKILL.md §2 contract for the "registry parse produced 0 entries" fatal condition.

### WR-03: Align SKILL.md fast-path with §3.2a matrix

**Files modified:** `skills/upstream-merge/SKILL.md`
**Commit:** `a9d183d`
**Applied fix:**
- Fast-path: replaced the contradictory `interfaces/agent-api.ts, agent-paths.ts, sampling.ts → ours + manual review` bullet with `interfaces/*` → `manual` (matching §3.2a row D-01..D-03).
- Fast-path: added a new bullet for `types/pi-*.d.ts` → `ours` (matrix row existed, fast-path was missing it).
- Matrix: filled silent gaps so the two views are truly consistent — added `tsconfig.json` (under `package.json`/`vitest.config.ts`), `.gitignore`/`.npmignore` (own row), and `.claude/*` (under `AGENTS.md`/`CLAUDE.md`).

### WR-04: Correct malformed-row semantics in special-cases.md

**Files modified:** `scripts/upstream-divergence.ts`, `skills/upstream-merge/references/special-cases.md`
**Commit:** `dd21e2e`
**Applied fix:**
- Parser hardening: `parseRegistry` now scans each line and emits `WARN: registry row not parsed (skipped): <row>` for any line that starts with `| ` but does not match the `| \`path\` |` schema and is not the markdown separator row (`| --- |`). The exit-code contract is unchanged (exit 2 only when the parsed set is completely empty).
- Doc fix (line 33): replaced the "a malformed row will surface as exit 2" claim with an honest description of the actual behaviour plus an explicit visual-verification step ("check the new path appears in the `✓ registered` section").

## Verification

After all 5 commits, `npm run upstream:check --no-color` was re-run and produced:
- Exit code: `0`
- Summary: `224 diverged, 17 registered, 207 default-resolved by category, 0 stale`
- 1 expected WARN line emitted by the new parser hardening (header row `| Path | Status | Why special | Decision |` is flagged as not parseable — this is correct).

The WARN line for the table header is the intended behavior of the WR-04 parser hardening (the header row starts with `| ` but doesn't match the `| \`path\` |` schema). It is now documented in the doc as the expected warning surface.

---

_Fixed at: 2026-06-22T10:55:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_