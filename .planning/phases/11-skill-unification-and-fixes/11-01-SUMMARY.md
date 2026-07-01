---
phase: 11-skill-unification-and-fixes
plan: 01
subsystem: infra
tags: [skills, upstream-merge, kilo-resolver, anchor-links, fork-only-registry, deprecation-banners]

# Dependency graph
requires:
  - phase: Phase 10 (StoreAdapter base class + PATH-01 self-reporting paths)
    provides: AGENT_ADAPTERS registry + resolverFactory() contract that the unified skill documents
provides:
  - Unified skills/mcp-adapter skill (SKILL.md + 5 reference files) replacing 3 fragmented skills
  - Migrated deploy-examples.md (402 lines) with correct GitHub anchor headings
  - Fixed anchor links in deploy.md (#branch-c-custom-agent)
  - Complete fork-only registry (7 Phase 11 entries in special-cases.md)
  - kilo-mcp-server.ts resolver fix (createKiloResolver instead of Pi default)
affects: [upstream-merge, skill-unification, kilo-deployment, qoder-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: [verbatim file migration via cp for byte-fidelity, GitHub-anchor-slug verification via grep, fork-only registry completeness via npm run upstream:check]

key-files:
  created:
    - skills/mcp-adapter/references/deploy-examples.md
  modified:
    - skills/mcp-adapter/references/deploy.md
    - skills/upstream-merge/references/special-cases.md
    - bin/kilo-mcp-server.ts
    - README.md
    - skills/deploy-mcp-adapter/SKILL.md
    - skills/generate-mcp-config/SKILL.md
    - skills/mcp-adapter-test/SKILL.md
    - skills/mcp-adapter-test/references/agent-paths/README.md

key-decisions:
  - "Single commit (Task 6) for all Phase 11 changes per plan design — upstream:check only exits 0 after all fork-only files are tracked in git HEAD together"
  - "deploy-examples.md migrated verbatim via cp (byte-for-byte identical) rather than rewritten — published npm package import paths preserved"
  - "GitNexus gitnexus_detect_changes() skipped (MCP tools unavailable); only .ts change is 1-line resolver fix, all others are .md"
  - "Plan's automated grep =1 for deploy-examples.md was over-constrained; correct intent is 1 registry ROW (verified via ^| prefix grep) since footer legitimately names the file"

patterns-established:
  - "Fork-only file migration: copy verbatim, register in special-cases.md, commit together so upstream:check stays green"
  - "GitHub anchor verification: heading '## Branch C: Custom Agent' slugifies to '#branch-c-custom-agent'; verify with grep not assumptions"

requirements-completed: [DEC-01, DEC-02, DEC-03, DEC-04, DEC-05]

# Metrics
duration: 10min
completed: 2026-06-26
---

# Phase 11 Plan 01: Skill Unification & Post-Phase-10 Fixes Summary

**Unified mcp-adapter skill shipped with deploy-examples.md migration, broken-anchor fixes, complete fork-only registry (7 entries), and kilo resolver fix — all committed with upstream:check exit 0**

## Performance

- **Duration:** ~10 min (596s)
- **Started:** 2026-06-26T10:01:30Z
- **Completed:** 2026-06-26T10:11:26Z
- **Tasks:** 6/6
- **Files modified:** 13 (7 added, 6 modified)

## Accomplishments
- Migrated `deploy-examples.md` (402 lines) verbatim from `skills/deploy-mcp-adapter/references/` to `skills/mcp-adapter/references/` — closing the missing-file gap referenced by SKILL.md line 206 and deploy.md lines 49/105/113
- Fixed 2 broken anchor links in `deploy.md` (`#custom-agent-integration` → `#branch-c-custom-agent` on lines 105 & 113) so they resolve to the actual `## Branch C: Custom Agent` heading
- Added `deploy-examples.md` to `special-cases.md` fork-only registry (entry 29/29) and updated footer from 28 → 29 anchored entries
- Verified prior Phase 11 work (DEC-01 through DEC-04) already present in working tree: unified SKILL.md + 4 reference files, dynamic resolver, capability-gate, kilo-mcp-server.ts resolver fix, 3 deprecation banners, README Kilo/Qoder explanation
- Confirmed full verification suite: tsc exit 0, 590 tests pass (10 skipped), verify:deploy kilo passes, upstream:check exit 0 with 0 stale entries post-commit
- Committed all 13 Phase 11 files in a single `feat(11):` commit (aa9ae4b) — working tree clean of Phase 11 source files

## Task Commits

This plan uses a **single consolidated commit** (Task 6) per explicit plan design — `upstream:check` only exits 0 after all 7 fork-only files are tracked in git HEAD together, so per-task commits were deferred:

1. **Task 1: [VERIFICATION] Confirm prior Phase 11 work** — read-only, no commit (verified DEC-01..DEC-04 + 6/7 DEC-05 entries present)
2. **Task 2: Migrate deploy-examples.md** — staged (not committed individually)
3. **Task 3: Fix broken anchor links in deploy.md** — staged (not committed individually)
4. **Task 4: Add deploy-examples.md to special-cases.md registry** — staged (not committed individually)
5. **Task 5: Full verification suite** — read-only, no commit (tsc/tests/verify:deploy pass; upstream:check shows expected 7 stale pre-commit)
6. **Task 6: Commit all Phase 11 changes** — `aa9ae4b` (feat) — 13 files, +1213/-3

**Plan metadata:** pending (SUMMARY/STATE/ROADMAP commit, see below)

## Files Created/Modified
- `skills/mcp-adapter/references/deploy-examples.md` — NEW, 402 lines, deployment code templates (Branch A/B/C for Pi, Qoder, Kilo, custom agents); migrated verbatim
- `skills/mcp-adapter/references/deploy.md` — anchor fix on lines 105 & 113 (#custom-agent-integration → #branch-c-custom-agent)
- `skills/upstream-merge/references/special-cases.md` — +1 registry row for deploy-examples.md, footer 28→29 anchored entries
- `bin/kilo-mcp-server.ts` — DEC-04: uses createKiloResolver().globalConfigPath() as 3rd arg to loadMcpConfig (was Pi default)
- `skills/mcp-adapter/SKILL.md` — DEC-01/03: unified skill (206 lines, Phase 0-3 structure + capability-gate)
- `skills/mcp-adapter/references/{generate,verify,resolver}.md` — DEC-01/02: migrated content + dynamic resolverFactory()
- `skills/deploy-mcp-adapter/SKILL.md`, `skills/generate-mcp-config/SKILL.md`, `skills/mcp-adapter-test/SKILL.md` — DEPRECATED banners
- `skills/mcp-adapter-test/references/agent-paths/README.md` — deprecation notice for legacy agent-paths dir
- `README.md` — Kilo/Qoder capability explanation

## Decisions Made
- **Single consolidated commit (Task 6):** Per plan design — `npm run upstream:check` only recognizes fork-only files once they're tracked in git HEAD. Committing incrementally would leave upstream:check in a perpetually-failing state mid-plan. The plan's Task 6 is the designated single commit point.
- **Verbatim migration via `cp`:** deploy-examples.md copied byte-for-byte (diff confirms IDENTICAL) rather than rewritten via Write tool — preserves published `pi-mcp-adapter` import paths and avoids transcription risk on 402 lines.
- **GitNexus pre-commit check skipped:** GitNexus MCP tools (`gitnexus_detect_changes`) unavailable in this execution environment. Per plan's Task 6 fallback clause, skipped and noted in commit body. Blast radius minimal: only `.ts` change is `bin/kilo-mcp-server.ts` (1-line resolver fix, already verified by tsc/tests/verify:deploy); all other changes are `.md` files (AGENTS.md GitNexus scope is `.ts` functions/classes/methods only).

## Deviations from Plan

### Auto-fixed Issues

None requiring code changes. One verification-criteria precision discrepancy noted below (informational, not a code fix).

### Verification-Criteria Precision Discrepancy (informational)

**1. [Documentation] Plan's automated grep over-constrained vs. its own footer text**
- **Found during:** Task 4 (registry entry verification)
- **Issue:** Plan's `<verify>` specified `grep -c "deploy-examples.md" special-cases.md = 1`, but the plan's own prescribed footer text ("...5 references files including deploy-examples.md") legitimately contains the literal string `deploy-examples.md`, producing 2 matches (1 registry row + 1 footer mention).
- **Resolution:** Verified the true intent — exactly 1 registry ROW — via `grep -c "^|.*deploy-examples.md"` (= 1). Content is correct per the plan's explicit footer instructions. No file change needed; documented for traceability.
- **Files affected:** skills/upstream-merge/references/special-cases.md
- **Committed in:** aa9ae4b

---

**Total deviations:** 0 auto-fixed code issues; 1 informational verification-criteria note
**Impact on plan:** None — content matches plan intent exactly. All success criteria met.

## Issues Encountered
- **Transient tsx EROFS error:** First post-commit `npm run upstream:check` invocation hit a tsx IPC-pipe `EROFS: read-only file system` error on `/tmp/tsx-0/`. Retried the command; it succeeded with exit 0 and 0 stale entries. Root cause: ephemeral tsx loader infrastructure glitch, not a script/logic error.

## User Setup Required
None — no external service configuration required. All changes are local documentation, skill files, and a 1-line TypeScript resolver fix.

## Next Phase Readiness
- Phase 11 complete: unified mcp-adapter skill fully functional with zero broken references
- All 7 fork-only files registered in special-cases.md; `npm run upstream:check` exits 0
- Working tree clean of Phase 11 source files (only intentionally-excluded AGENTS.md/CLAUDE.md/.planning remain modified/untracked)
- No blockers. Ready for next milestone or phase.

## Self-Check: PASSED

- All 5 key files FOUND on disk (deploy-examples.md, deploy.md, special-cases.md, SKILL.md, SUMMARY.md)
- Commit `aa9ae4b` FOUND in git log
- deploy.md anchors verified: 0 × `custom-agent-integration`, 2 × `branch-c-custom-agent`
- special-cases.md registry verified: 1 row for deploy-examples.md

---
*Phase: 11-skill-unification-and-fixes*
*Completed: 2026-06-26*
