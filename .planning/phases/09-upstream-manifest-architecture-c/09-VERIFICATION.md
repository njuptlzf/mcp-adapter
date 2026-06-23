---
phase: 09-upstream-manifest-architecture-c
verified: 2026-06-22T19:30:00Z
verdict: PASS
must_haves_total: 5
must_haves_met: 5
requirements_status:
  UPSTREAM-01: met
  UPSTREAM-02: met
  UPSTREAM-03: met
  UPSTREAM-04: met
  UPSTREAM-05: met
live_run:
  exit_code: 0
  diverged: 225
  registered: 17
  default_resolved: 208
  stale: 0
false_negatives_check: clean
---

# Phase 9: Upstream Manifest Architecture C Refactor — Verification Report

**Phase Goal:** Replace Phase 8's 209-row UPSTREAM-CHANGES.md manifest with Architecture C — a special-cases-only registry with 12-category default-resolution matrix, plus a runnable divergence-check tool, so future upstream merges no longer require manually maintaining a flat file list.

**Verified:** 2026-06-22T19:30:00Z
**Status:** PASS

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UPSTREAM-CHANGES.md is no longer at the repo root | ✓ VERIFIED | `ls: cannot access 'UPSTREAM-CHANGES.md'`; `git log --diff-filter=D` shows commit `b22fdca` (`chore(09-01): retire UPSTREAM-CHANGES.md`) |
| 2 | `references/special-cases.md` exists with 4-column schema and 17 anchored entries | ✓ VERIFIED | File present (38 lines); header row `\| Path \| Status \| Why special \| Decision \|`; 17 backtick-wrapped rows (`grep -cE '^\| \`' = 17`) covering index.ts, mcp-panel.ts, mcp-setup-panel.ts, panel-keys.ts, interfaces/{agent-api,agent-paths,sampling}.ts, package.json, vitest.config.ts, tsconfig.json, README.md, MAPPING.md, CHANGELOG.md, OAUTH.md, types/pi-{coding-agent,ai,tui}.d.ts |
| 3 | `npm run upstream:check` exits 0 in clean state with 3-category classification | ✓ VERIFIED | Exit code 0; output: `[divergence-check] summary: 225 diverged, 17 registered, 208 default-resolved by category, 0 stale` |
| 4 | `SKILL.md` §2 has zero references to `UPSTREAM-CHANGES.md` (was 7) and ≥2 references to `references/special-cases.md` | ✓ VERIFIED | `grep -c 'UPSTREAM-CHANGES' SKILL.md = 0`; `grep -c 'special-cases' SKILL.md = 7` (YAML frontmatter description + §2 prose + §2 lookup commands + §3.2a prose + 2× other cross-references) |
| 5 | 12-category matrix inlined into SKILL.md §3.2a | ✓ VERIFIED | Lines 135-149: header `\| Category \| Default \| Rationale \| Source \|` + 12 rows (adapters/<agent>/*, adapters/entry.ts, skills/*, interfaces/*, package.json/vitest.config.ts/tsconfig.json, .gitignore/.npmignore, __tests__/*/tests/*, Core MCP source, types.ts/utils.ts/errors.ts/logger.ts, README.md/MAPPING.md/CHANGELOG.md/OAUTH.md, AGENTS.md/CLAUDE.md/.claude/*, .planning/*, types/pi-*.d.ts) |
| 6 | `scripts/upstream-divergence.ts` exists, type-correct, implements D-34 contract | ✓ VERIFIED | 135 lines; `npx tsc --noEmit -p tsconfig.json` exits 0; contains GnuTLS workaround verbatim from 08-LEARNINGS.md L-4 (incl. `--tags` after CR-01 fix); implements 3-category classification; ANSI color with auto-detect; exit codes 0/1/2 |
| 7 | `package.json` contains `"upstream:check": "tsx scripts/upstream-divergence.ts"` (no other upstream:* hooks) | ✓ VERIFIED | Line 17 of scripts block; only `upstream:*` entry; Q5 user decision: no `//` comment added |
| 8 | No pre-commit / pre-merge / CI hook installed | ✓ VERIFIED | No `.husky/` directory; no `.github/` directory; no git hooks reference `upstream:check` |
| 9 | `.planning/` directory unmodified (Phase 9 scope boundary) | ✓ VERIFIED | `git status --porcelain .planning/` returns empty |

**Score:** 5/5 must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `skills/upstream-merge/references/special-cases.md` | 17 anchored entries, 4-col schema | ✓ VERIFIED | 38 lines, header `\| Path \| Status \| Why special \| Decision \|`, 17 entries, preamble cites D-31 + D-32, "How to add an entry" section with visual-verification guidance (corrected per WR-04) |
| `scripts/upstream-divergence.ts` | D-34 contract implementation | ✓ VERIFIED | 135 lines; passes `npx tsc --noEmit -p tsconfig.json` (exit 0); JSDoc header documents D-34 contract; GnuTLS workaround verbatim from L-4 (incl. `--tags` after CR-01); 3-category classification; ANSI color auto-detect + `--no-color`/`--color` flags; exit codes 0/1/2; rename/copy status handling (WR-01); try/catch on `readFileSync` (WR-02); malformed-row WARN logging (WR-04) |
| `skills/upstream-merge/SKILL.md` | §1/§2/§3.2/§4(e) modified; §3.1/§3.3 byte-identical to Phase 8 | ✓ VERIFIED | 178 lines (vs Phase 8's 142; +36 from 12-cat matrix + cross-check doc); §3.1 grep (5 sub-commands) and §3.3 rule of thumb preserved; §3.2 split into §3.2a matrix + §3.2b 5-step flow; §4(e) rewired to divergence script |
| `package.json` | `upstream:check` npm script | ✓ VERIFIED | Line 17: `"upstream:check": "tsx scripts/upstream-divergence.ts"`; only `upstream:*` entry; no comments |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `SKILL.md` | `references/special-cases.md` | §2 relative path reference | ✓ WIRED | 7 references; SKILL.md line 40: `grep -F '\`init.ts\`' skills/upstream-merge/references/special-cases.md` |
| `SKILL.md` | `scripts/upstream-divergence.ts` | `npm run upstream:check` invocation + §4(e) gate | ✓ WIRED | Lines 26, 50, 53, 60, 175: `npm run upstream:check` and/or `npx tsx scripts/upstream-divergence.ts` |
| `package.json` | `scripts/upstream-divergence.ts` | `tsx` wrapper | ✓ WIRED | `"upstream:check": "tsx scripts/upstream-divergence.ts"` (line 17) |
| `scripts/upstream-divergence.ts` | `references/special-cases.md` | `readFileSync` with `__dirname`-relative path resolution | ✓ WIRED | Lines 23-26: `REGISTRY_PATH = resolve(dirname(new URL(import.meta.url).pathname), "../skills/upstream-merge/references/special-cases.md")` |
| `scripts/upstream-divergence.ts` | `git diff upstream/main` | `execFileSync` with GnuTLS workaround | ✓ WIRED | Line 51: `runGit(["-c", "http.sslVerify=false", "fetch", "upstream", "--tags"], { GIT_SSL_NO_VERIFY: "1" })` — verbatim from 08-LEARNINGS.md L-4 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles project-wide | `npx tsc --noEmit -p tsconfig.json` | Exit 0, no errors | ✓ PASS |
| Divergence check exits 0 in clean state | `npm run upstream:check --no-color` | Exit 0; 225 diverged / 17 registered / 208 default-resolved / 0 stale | ✓ PASS |
| Registry parses 17 paths | `grep -cE '^\| \`' skills/upstream-merge/references/special-cases.md` | 17 | ✓ PASS |
| SKILL.md has 12-category matrix header | `grep -E '^\| Category \| Default \| Rationale \| Source' SKILL.md` | matches | ✓ PASS |
| SKILL.md has zero UPSTREAM-CHANGES refs | `grep -c 'UPSTREAM-CHANGES' SKILL.md` | 0 | ✓ PASS |
| SKILL.md has ≥2 references/special-cases refs | `grep -c 'special-cases' SKILL.md` | 7 | ✓ PASS |
| UPSTREAM-CHANGES.md deleted | `ls UPSTREAM-CHANGES.md` | "No such file or directory" | ✓ PASS |
| No `.husky/` directory | `ls .husky/` | "No such file or directory" | ✓ PASS |
| No `.github/` directory | `ls .github/` | "No such file or directory" | ✓ PASS |
| GnuTLS workaround includes `--tags` (per CR-01 fix) | `grep -n -- '--tags' scripts/upstream-divergence.ts` | Lines 15, 49, 51 | ✓ PASS |

### Live Run Output

```
$ npm run upstream:check --no-color

[divergence-check] WARN: registry row not parsed (skipped): | Path | Status | Why special | Decision |
[divergence-check] upstream ref: main, scanned 225 files
✓ registered (17):
   CHANGELOG.md
   MAPPING.md
   OAUTH.md
   README.md
   index.ts
   interfaces/agent-api.ts
   interfaces/agent-paths.ts
   interfaces/sampling.ts
   mcp-panel.ts
   mcp-setup-panel.ts
   package.json
   panel-keys.ts
   tsconfig.json
   types/pi-ai.d.ts
   types/pi-coding-agent.d.ts
   types/pi-tui.d.ts
   vitest.config.ts
⚠ diverged-but-not-registered (208): [category: assess]
   [208 paths resolved by 12-category matrix in §3.2a]
✗ stale (registry entry no longer diverged) (0):
[divergence-check] summary: 225 diverged, 17 registered, 208 default-resolved by category, 0 stale
[divergence-check] exit: 0

EXIT CODE: 0
```

The WARN line is the intended behavior of WR-04 parser hardening (the markdown table header row starts with `| ` but doesn't match the `| \`path\` |` schema). This is now documented in `special-cases.md` line 33 as the expected warning surface.

### Migration Traceability (Phase 8 → Phase 9)

All 4 Phase 8 manifest footnotes + `panel-keys.ts` (L-5) appear in the new registry:

| Phase 8 footnote | Phase 9 registry entry | Status |
|---|---|---|
| `mcp-panel.ts` (DECOUPLE-06 follow-up) | `mcp-panel.ts` (`decoupled-wrapper`, `assess`) | Direct migration |
| `mcp-setup-panel.ts` (DECOUPLE-06 follow-up) | `mcp-setup-panel.ts` (`decoupled-wrapper`, `assess`) | Direct migration |
| `index.ts` (D-04 backward-compat) | `index.ts` (`decoupled-wrapper`, `ours`) | Direct migration |
| `interfaces/agent-api.ts` (legal JSDoc) | `interfaces/agent-api.ts` (`decoupled-wrapper`, `manual`) | Direct migration |
| `panel-keys.ts` (deleted-in-fork per L-5) | `panel-keys.ts` (`deleted-in-fork`, `ours`) | Direct migration |
| (new in Phase 9) | 12 more entries | Coverage expansion |

### False-Negatives Check

Two remaining `UPSTREAM-CHANGES.md` mentions in the repo (both intentional, not regressions):

1. `skills/upstream-merge/references/special-cases.md` line 5 — preamble cites the retired manifest as a migration pointer for future maintainers (per D-32 trade-off mitigation).
2. `skills/upstream-merge/references/pi-coupling-markers.md` line 41 — historical reference in the "Hits in `commands.ts` (14× per `UPSTREAM-CHANGES.md`)" note. This is a static citation within an unmodified Phase 8 reference doc; it doesn't create a working dependency on the deleted file.

Both are documentation citations, not artifact dependencies. **No false negatives.**

### Code Review Fix Traceability

Code review (09-REVIEW.md) identified 1 critical + 4 warnings + 3 info items. All 5 in-scope findings fixed (09-REVIEW-FIX.md):

| ID | Title | Commit | Files |
|----|-------|--------|-------|
| CR-01 | Add `--tags` to GnuTLS workaround | `bf82a91` | `scripts/upstream-divergence.ts`, `SKILL.md` |
| WR-01 | Handle rename/copy status in `parseDiff` | `77ef3ed` | `scripts/upstream-divergence.ts` |
| WR-02 | Wrap `parseRegistry` `readFileSync` in try/catch | `87e4e72` | `scripts/upstream-divergence.ts` |
| WR-03 | Align SKILL.md fast-path with §3.2a matrix | `a9d183d` | `SKILL.md` |
| WR-04 | Correct malformed-row semantics in special-cases.md | `dd21e2e` | `scripts/upstream-divergence.ts`, `references/special-cases.md` |

The 3 info items (IF-01 `wraps-theirs` unused, IF-02 hardcoded `upstream/main`, IF-03 swallowed first error) were left as informational; they don't affect goal achievement and adding flags/handlers was deemed out-of-scope per the user's commit pattern.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UPSTREAM-01 | 09-01 | Special-cases-only registry (max ~20 anchored entries) | ✓ SATISFIED | 17 entries in `skills/upstream-merge/references/special-cases.md`; full manifest retired |
| UPSTREAM-02 | 09-01 | Each entry anchored: Path + Status + Why special + Decision | ✓ SATISFIED | All 17 entries have all 4 columns populated |
| UPSTREAM-03 | 09-01 | 12-category default-resolution matrix handles remaining paths | ✓ SATISFIED | Matrix inlined into SKILL.md §3.2a; 208 of 225 diverged paths resolved by matrix |
| UPSTREAM-04 | 09-01 | `npm run upstream:check` exits 0 when clean | ✓ SATISFIED | Exit 0; 0 stale entries |
| UPSTREAM-05 | 09-01 | No pre-commit / pre-merge / CI hooks (manual-only per D-33) | ✓ SATISFIED | No `.husky/`, no `.github/`, only `upstream:*` script is `upstream:check` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/upstream-divergence.ts` | 88 | `console.warn` for malformed registry rows | ℹ️ Info | Intentional per WR-04 parser hardening; expected to fire on the markdown header row, documented in `special-cases.md` line 33 |

No blockers or warnings found.

### Human Verification Required

None — all Phase 9 deliverables are verifiable via static analysis + the runnable `npm run upstream:check` script (which was executed and produced exit 0).

The Phase 9 scope is purely internal refactoring (no UI, no external service integration, no real-time behavior, no performance-critical path). Visual/UX verification is not applicable.

### Gaps Summary

None. All 5 must-haves met; all 5 requirements satisfied; live run exits 0 with the expected counts.

---

_Verified: 2026-06-22T19:30:00Z_
_Verifier: the agent (gsd-verifier)_