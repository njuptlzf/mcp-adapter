# Requirements — Milestone v3.1

> **Milestone:** v3.1 — upstream-merge 治理与架构优化
> **Source:** `docs/upstream-merge-retrospective.md` (772 lines, 2026-07-01)
> **Date:** 2026-07-01
> **Status:** PLANNING

## Context

First real `git merge upstream/main` attempt (2026-07-01) produced **11 conflict files** spanning ~1300 lines. Conflict categorization:

| Category | Count | % | Action |
|----------|-------|---|--------|
| 🏛️ import-region conflict | 3 | 27% | Architecture debt (Phase 14) |
| ⚠️ same-function conflict | 3 | 27% | Need agent analysis (Phase 13 protocol) |
| 🔴 same-function-body large conflict | 1 | 9% | Decompose first (Phase 14) |
| ✅ same-file different-section | 4 | 37% | User rule 2 applies (Phase 13 protocol) |

The retrospective produced a 4-question reflection + P0/P1/P2 improvement plan. v3.1 ships that plan.

## v3.1 Requirements (Active)

### Category: MERGE (upstream-merge policy)

- [x] **MERGE-01**: User can run `git merge upstream/main` with default `--theirs` policy in `assess` rows (SKILL.md §4.1)
- [x] **MERGE-02**: SKILL.md §4.2b reduces from 5-step mandatory follow-up to 2-step soft follow-up, with explicit `gh` CLI unavailability fallback
- [x] **MERGE-03**: User gets conflict hunk independence classification via new §3.5 (4 categories: different function / same-function-different-section / same-function-same-section / import-region)
- [x] **MERGE-04**: Agent follows 5-step same-function conflict resolution protocol via new §4.4 (extract ours/theirs → view function context → classify merge mode → document decision in commit body)

### Category: ARCH (file-level architecture)

- [x] **ARCH-02**: `elicitation-handler.ts` (286 lines) decomposed into 3 files: `elicitation/form-handler.ts`, `elicitation/url-handler.ts`, `elicitation/coerce.ts`
- [x] **ARCH-03**: `proxy-modes.ts` (835 lines) decomposed into 4 files: `proxy/manager.ts`, `proxy/stdio.ts`, `proxy/http.ts`, `proxy/sse.ts`
- [x] **ARCH-04**: `__tests__/init-elicitation.test.ts` (98 lines, 3 conflict hunks) decomposed into 3 files: `init-elicitation-success.test.ts`, `init-elicitation-error.test.ts`, `init-elicitation-cancel.test.ts`
- [x] **ARCH-05**: All decomposed files maintain single-responsibility (each file <350 lines, one logical concern)
- [x] **ARCH-06 (NEW, replaces retired ARCH-01)**: `adapters/entry.ts` (381 lines, `createMcpAdapter` 324 lines) — extract module-level helpers where closure-independent + add intra-function section dividers. Target: file ≤350 lines, `createMcpAdapter` ≤300 lines.

### Category: ARCH-RETIRED

- ~~**ARCH-01**: `index.ts` `mcpAdapter()` function body (343 lines) decomposed into 4 small functions~~ — **RETIRED 2026-07-01**: Phase 5 entry-point refactor already made `index.ts` a 27-line thin wrapper. The "343 行 mcpAdapter" is actually `adapters/entry.ts` `createMcpAdapter` (324 lines), tracked as **ARCH-06**.

### Category: CI (defensive continuous integration)

- [x] **CI-01**: GitHub Actions workflow detects Pi-coupling re-introduction in `src/` (excluding `adapters/`, `types/`, `__tests__/`)
- [x] **CI-02**: `scripts/upstream-divergence.ts` extended to output JSON with `hunk-independence` field (4 categories from MERGE-03)
- [x] **CI-03**: Local `npm run predict-conflicts` script (or similar) runs 3-way diff to pre-identify potential conflicts before merge

## Out of Scope (Explicit Exclusions)

- **Not changing upstream content** — fork is downstream, not adversarial
- **Not introducing new npm dependencies** — avoid scope creep
- **Not breaking Phase 1-12 work** — backward compatibility required
- **Not refactoring interfaces/** — abstractions are complete and tested; the debt is in core file-level architecture
- **Not removing the universal-mcp architecture** — Phase 12 deliverables (bin/mcp-server.ts, InlineMcpAdapter, etc.) are stable

## Traceability

| REQ-ID | Phase | Source (retrospective section) |
|--------|-------|--------------------------------|
| MERGE-01 | Phase 13 | §3.1 P0-1 |
| MERGE-02 | Phase 13 | §3.1 P0-2 |
| MERGE-03 | Phase 13 | §3.1 P0-3 (new §3.5) |
| MERGE-04 | Phase 13 | §3.1 P0-4 (new §4.4) |
| ARCH-01 | ~~Phase 14~~ (retired) | Retired 2026-07-01 (Phase 5 already did this) |
| ARCH-02 | Phase 14 | §3.2 P1-2 (elicitation-handler.ts, was 565 lines) |
| ARCH-03 | Phase 14 | §3.2 P1-3 (proxy-modes.ts, was 958 lines) |
| ARCH-04 | Phase 14 | §3.2 P1-4 (init-elicitation.test.ts) |
| ARCH-05 | Phase 14 | §3.2 success criterion (single-responsibility) |
| **ARCH-06** | Phase 14 | **NEW**: real target is `adapters/entry.ts` 381 lines (retrospective incorrectly listed `index.ts` 343 lines, but Phase 5 already made `index.ts` 27 lines) |
| CI-01 | Phase 15 | §3.3 P2-1 (CI type-boundary guard) |
| CI-02 | Phase 15 | §3.3 P2-2 (conflict-statistics dashboard) |
| CI-03 | Phase 15 | §3.3 P2-3 (same-file-conflict predictor) |

## Validated Requirements (preserved from v1.0/v2.0)

- REQ-01 (Generic AgentAPI Interface) — validated Phase 01
- REQ-02 (UI System Interface) — validated Phase 01
- REQ-03 (Pi Adapter Implementation) — validated Phase 01
- REQ-04 (Backward Compatibility) — validated Phase 01
- REQ-05 (Dependency Restructuring) — validated Phase 01
- REQ-06 (Documentation) — validated Phase 01
- REQ-07 (Testing) — validated Phase 01

(Plus all v2.0/v3.0 internal validations in PROJECT.md `## Validated Requirements`.)

## Future Requirements (deferred)

- Auto-merge tooling (deferred until CI-03 predictor proves valuable)
- Web UI for conflict visualization (deferred)
- Cross-fork synchronization (deferred — not in current scope)

## Quality Criteria

Good v3.1 requirements (per GSD template):

- ✅ **Specific and testable**: "decomposed into 4 small functions" (not "split index.ts")
- ✅ **User-centric**: "User can run `git merge upstream/main` with default `--theirs` policy"
- ✅ **Atomic**: One capability per REQ-ID
- ✅ **Independent**: MERGE-* can ship without ARCH-* or CI-* (Phases 13→14→15 in order)
