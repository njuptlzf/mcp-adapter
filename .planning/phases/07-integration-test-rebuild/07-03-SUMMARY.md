---
phase: 07-integration-test-rebuild
plan: 03
subsystem: testing
tags: [skill, parametric, agent-agnostic, mcp-adapter-test, capability-gate, upstream-merge]

# Dependency graph
requires:
  - phase: 07-integration-test-rebuild
    plan: 01
    provides: "AGENT_ADAPTERS static registry + parametric adapter contract test (D-07/D-08/D-09)"
  - phase: 06-second-agent-adapter
    plan: 05
    provides: "QoderAdapter mcp-adapter-test skill run + Phase 7 TEST-01..05 follow-ups"
provides:
  - "Short parametric main SKILL.md (148 lines, down from 228)"
  - "Three per-agent reference files (pi.md, qoder.md, _template.md) under references/agent-paths/"
  - "Capability Gate extracted as Step 0 of Phase 4 (D-03)"
  - "Phase 4 renamed 'Per-Path Verification' with parametric table (D-11)"
  - "Phase 8 UPSTREAM-04 merge-friendly structure (D-21)"
affects:
  - phase: 07-integration-test-rebuild/04
    note: "Subsequent plan in this phase can reference the parametric skill structure"
  - phase: 08-upstream-merge-conflict-resolution
    note: "Short parametric SKILL.md minimizes upstream merge-conflict surface (UPSTREAM-04)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Main + per-agent references skill structure (parametric main, agent-specific HOW)"
    - "Add-an-adapter = copy _template.md → <id>.md; main file untouched"

key-files:
  created:
    - path: "skills/mcp-adapter-test/references/agent-paths/pi.md"
      lines: 29
      purpose: "Pi-specific Path A/B/C verification commands"
    - path: "skills/mcp-adapter-test/references/agent-paths/qoder.md"
      lines: 30
      purpose: "Qoder-specific Path A/B/C verification commands + companion methods note"
    - path: "skills/mcp-adapter-test/references/agent-paths/_template.md"
      lines: 29
      purpose: "Scaffold for new adapters with <AGENT_ID> placeholders (6 placeholders)"
  modified:
    - path: "skills/mcp-adapter-test/SKILL.md"
      before_lines: 228
      after_lines: 148
      delta: "-80 lines (~35% reduction)"
      purpose: "Rewrite to short parametric main file (D-10/D-11)"

key-decisions:
  - "D-10: Main SKILL.md describes WHAT each phase does; adapter-specific HOW lives in references/agent-paths/<id>.md"
  - "D-11: Phase 4 renamed 'Per-Path Verification' with parametric table — Pi-biased prose of old §122-138 removed"
  - "D-03: Capability Gate extracted as Phase 4 Step 0; runs FIRST before any E2E test"
  - "D-21: New adapter = add references/agent-paths/<id>.md from _template.md; main SKILL.md untouched (Phase 8 UPSTREAM-04 compatibility)"
  - "AGENT_ADAPTERS reference added to main SKILL.md (Phase 4 Step 0) — references the static registry from plan 07-01"

patterns-established:
  - "Main + per-agent references skill structure: parametric main file (semantic) + per-adapter reference files (commands)"
  - "_template.md scaffold pattern: <AGENT_ID> placeholders (6 occurrences) for new-adapter authoring"
  - "Parametric table instead of prose for path classification: `mcp` in tool list? + `^<server>_` prefix? → Path A/B/C"

requirements-completed: [TEST-05]

# Metrics
duration: ~6min
completed: 2026-06-17
---

# Phase 7 Plan 03: SKILL.md Parametric Structure + Per-Agent References

**Main `skills/mcp-adapter-test/SKILL.md` rewritten from 228 to 148 lines (~35% reduction); agent-specific HOW extracted to three per-agent reference files under `references/agent-paths/` (pi.md, qoder.md, _template.md). Phase 4 renamed "Per-Path Verification" with a parametric table; Capability Gate extracted as Step 0. Adding a new adapter = copy `_template.md` → `<id>.md`; main SKILL.md is untouched (Phase 8 UPSTREAM-04 compatibility).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-17T06:29:37Z
- **Completed:** 2026-06-17T06:35:00Z (approx)
- **Tasks:** 2 (auto)
- **Files created:** 3 (`references/agent-paths/pi.md`, `qoder.md`, `_template.md`)
- **Files modified:** 1 (`skills/mcp-adapter-test/SKILL.md`)

## Accomplishments

- **Created the agent-paths directory** `skills/mcp-adapter-test/references/agent-paths/` (kept existing `mcp-config.md` and `smoke-calls.md` references intact).
- **Wrote `pi.md`** (29 lines): Pi-specific Path A/B/C verification commands plus Pi env-var/cleanup notes (`~/.pi/agent/mcp.json`, `MCP_AGENT_DIR`, legacy `PI_CODING_AGENT_DIR`).
- **Wrote `qoder.md`** (30 lines): Qoder-specific Path A/B/C verification commands, `attachQuery`/`detachQuery` companion-method notes, UISystem limitations (no `form`/`setStatus`/`theme`; only `notify` exposed per D-07).
- **Wrote `_template.md`** (29 lines): Scaffold for new adapters with 6 `<AGENT_ID>` placeholders, Path A/B/C shell, optional UISystem surface note, env-var + companion-methods slots.
- **Rewrote main `SKILL.md`** (228 → 148 lines):
  - Front-matter description expanded to "Universal mcp-adapter integration test" + agent-agnostic parameter list.
  - New "Agent-agnostic parametric structure" section with reference-file table (Pi/Qoder/New).
  - Quick Start collapsed from 7 to 6 bullets; pre-flight collapsed.
  - Phase 2/3 pass-criteria tables collapsed to single-line summaries (≥ 95% / ≥ 65% / ≤ 300 tokens).
  - **Phase 4 renamed "Per-Path Verification"** (D-11). Old Pi-biased §122-138 prose removed; replaced by Step 0 Capability Gate table + Step 1 reference-file pointer.
  - **Capability Gate extracted as Step 0** (D-03); explicitly labeled "universal, runs FIRST".
  - Phase 5 collapsed to one sentence + bullet list inline.
  - One-Screen Summary kept (with Capability Gate row).
  - Reference Files table now lists all 5 references (3 agent-paths + mcp-config + smoke-calls).
- **Phase 8 UPSTREAM-04 readiness**: with parametric main file + per-agent refs, future adapter additions do not modify SKILL.md → upstream merge conflicts shrink to per-file scope.

## Files Created/Modified

- `skills/mcp-adapter-test/references/agent-paths/pi.md` (NEW, 29 lines) — Pi Path A/B/C commands + cleanup
- `skills/mcp-adapter-test/references/agent-paths/qoder.md` (NEW, 30 lines) — Qoder Path A/B/C + companion methods
- `skills/mcp-adapter-test/references/agent-paths/_template.md` (NEW, 29 lines) — Scaffold with 6 `<AGENT_ID>` placeholders
- `skills/mcp-adapter-test/SKILL.md` (REWRITE, 228 → 148 lines) — Short parametric main file

## Decisions Made

- **Parametric prose preserved in template**: The `_template.md` uses `<AGENT_ID>`, `<agent>`, `<server>`, `<AGENT_ID>Adapter` placeholders so any new-adapter author can follow the same shape without writing new prose.
- **No edits to existing references**: `mcp-config.md` and `smoke-calls.md` were kept untouched (Phase 4 Step 4 still points to `tests/smoke/e2e-all-servers.test.ts`, not to smoke-calls.md, because the E2E runner is not adapter-specific).
- **One-line Phase 2/3 pass criteria**: collapsed 2-row tables into single-line text to keep SKILL.md under 160 lines without losing information. The values (≤ 300, ≥ 95%, ≥ 65%) are unchanged.
- **AGENT_ADAPTERS forward reference**: SKILL.md Phase 4 Step 0 references the static registry exported by `interfaces/agent-api.ts` (introduced in plan 07-01). The verdict table uses `adapter.getAllTools()` semantics, not env-var introspection.

## Deviations from Plan

None - plan executed exactly as written. Both tasks completed on first attempt. All acceptance criteria satisfied on first run.

## Verification

```bash
# Task 1: per-agent reference files
ls skills/mcp-adapter-test/references/agent-paths/
# → _template.md  pi.md  qoder.md

grep -c "^# Pi — Path A"   skills/mcp-adapter-test/references/agent-paths/pi.md      # → 1
grep -c "^# Qoder — Path A" skills/mcp-adapter-test/references/agent-paths/qoder.md   # → 1
grep -c "<AGENT_ID>"       skills/mcp-adapter-test/references/agent-paths/_template.md  # → 6

test -s skills/mcp-adapter-test/references/agent-paths/pi.md && \
test -s skills/mcp-adapter-test/references/agent-paths/qoder.md && \
test -s skills/mcp-adapter-test/references/agent-paths/_template.md
# → ALL_FILES_NON_EMPTY

# Task 2: parametric main SKILL.md
wc -l skills/mcp-adapter-test/SKILL.md          # → 148  (≤ 160 ✓)
grep -c "AGENT_ADAPTERS"           SKILL.md      # → 2    (≥ 1 ✓)
grep -c "references/agent-paths/"  SKILL.md      # → 9    (≥ 3 ✓)
grep -c "Per-Path Verification"    SKILL.md      # → 2    (≥ 1 ✓)
grep -c "Capability Gate (universal, runs FIRST)" SKILL.md  # → 1 (≥ 1 ✓)
grep -c "^## Phase [1-5]"          SKILL.md      # → 5    (= 5 ✓)
```

All Task 1 acceptance criteria PASS. All Task 2 acceptance criteria PASS.

## Task Commits

| Task | Commit | Files | Notes |
|------|--------|-------|-------|
| 1 | `a22e4b0` | `references/agent-paths/{pi,qoder,_template}.md` | feat: 3 files / 88 insertions; new dir + 3 reference files |
| 2 | `df59f62` | `SKILL.md` | refactor: rewrite 228 → 148 lines (35% reduction); 1 file changed, 149 insertions(+), 227 deletions(-); rewrite (73%) |

## Issues Encountered

None - both tasks executed as specified. No deviation rules triggered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **TEST-05 satisfied**: SKILL.md is now agent-agnostic and parametric.
- **Plan 07-04 readiness**: The remaining plan in this phase (matrix report + globalSetup) can reference the new parametric skill structure and the existing AGENT_ADAPTERS registry (D-07) introduced in plan 07-01.
- **Phase 8 readiness**: SKILL.md is now short + parametric; per-agent additions become new files in `references/agent-paths/`, so future upstream merges against SKILL.md become rare → UPSTREAM-04 precondition met.
- **New-adapter authoring path**: copy `references/agent-paths/_template.md` → `<your-id>.md`, fill in Path A/B/C sections, add one row to the parametric table in `SKILL.md` ("Agent-agnostic parametric structure" section). The main file's Phase 4 Step 1 text already says "Read `references/agent-paths/<id>.md`", so no further wiring is needed.

---
*Phase: 07-integration-test-rebuild*
*Completed: 2026-06-17*