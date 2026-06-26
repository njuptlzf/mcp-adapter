---
phase: 10-store-adapter-refactor
plan: 03
type: execute
subsystem: upstream-merge / testing
tags:
  - special-cases
  - registry
  - contract-tests
  - verification
  - parametric-testing
depends_on:
  - 10-01
  - 10-02
provides:
  - UP-01: store-adapter.ts registered as fork-only/ours in special-cases.md
  - UP-02: qoder-adapter.ts and kilo-adapter.ts status updated to decoupled-wrapper/ours
  - STORE-04: PiAdapter unchanged (verified via contract tests)
  - PATH-01: mcpConfigPath field verified through existing test suite
affects:
  - skills/upstream-merge/references/special-cases.md (20→23 entries)
  - __tests__/adapter-contract.test.ts (+4 lines doc comment)
tech-stack:
  added: []
  patterns:
    - parametric-contract-testing (describe.each with AGENT_ADAPTERS)
    - registry-driven-upstream-divergence (special-cases.md → upstream-divergence.ts)
decisions: []
key-files:
  created: []
  modified:
    - skills/upstream-merge/references/special-cases.md (20→23 entries, +3 new, +1 footer update)
    - __tests__/adapter-contract.test.ts (+4 lines documentation comment)
metrics:
  tasks: 3
  files: 2
  duration: ~5min
  completed_date: "2026-06-26T06:02:16Z"
---

# Phase 10 Plan 03: StoreAdapter Base Class & Agent Self-Reporting Paths — Summary

**One-liner:** Updated upstream-merge special-cases registry with 3 new Phase 10 entries (store-adapter.ts fork-only, qoder/kilo-adapter decoupled-wrapper), verified full 590-test suite + TypeScript compilation + parametric contract tests across all 3 agents.

---

## Execution Summary

All 3 tasks completed autonomously with zero deviations. The upstream-merge registry now correctly reflects Phase 10's architectural changes, and all verification gates pass — TypeScript compilation (zero errors), full test suite (590/600 pass, 10 gated skipped), parametric contract tests (22/22 across kilo/pi/qoder), and upstream divergence check (exit 0, no stale entries).

### Task 1: Update upstream-merge special-cases registry

**Status:** ✅ Complete
**Commit:** `2e9d010`

**Changes:**
- **`adapters/store-adapter.ts`** — Added as `fork-only` / `ours`. Zero Pi imports, zero conflict risk with upstream (UP-01).
- **`adapters/qoder-adapter.ts`** — Added as `decoupled-wrapper` / `ours`. Thin StoreAgentAdapter wrapper with Qoder-specific `Query.streamInput` routing (UP-02).
- **`adapters/kilo-adapter.ts`** — Added as `decoupled-wrapper` / `ours`. Thin StoreAgentAdapter wrapper with Kilo-specific `sendMessageFn` callback (UP-02).
- **Footer updated:** `2026-06-26 (Phase 10 StoreAdapter refactor + agent self-reporting paths; 23 anchored entries)`

**Verification:**
- `npm run upstream:check` exits 0 — all 23 entries recognized in `✓ registered` section
- No `⚠ diverged-but-not-registered` warnings for the 3 new files
- Zero stale entries

### Task 2: Verify adapter contract test + full test suite

**Status:** ✅ Complete
**Commit:** `d25bddf`

**Changes:**
- **`__tests__/adapter-contract.test.ts`** (+4 lines): Added documentation comment noting that `StoreAgentAdapter` is tested indirectly through `QoderAdapter` and `KiloAdapter` parametric contract tests.

**Verification:**
- `npx vitest run __tests__/adapter-contract.test.ts` — 22/22 passed (6 tests × 3 agents = 18 parametric + 4 MockAgentAPI)
- `npm test` — 590/600 passed (55 test files), 10 skipped (gated QODER_INTEGRATION tests)
- `npx tsc --noEmit` — zero type errors

### Task 3: Run full verification suite and confirm rollback readiness

**Status:** ✅ Complete (verification-only, no commit needed)

**Verification results:**
- `npx tsc --noEmit` — zero errors ✅
- `npm test` — 590/600 pass, all 55 test files pass ✅
- `npm run upstream:check` — exits 0, 23 registered, 0 stale ✅
- QoderAdapter parity: 40/40 unit + 8/8 integration pass ✅
- KiloAdapter parity: 6/6 parametric contract tests pass for kilo agent ✅
- Parametric contract verbose: all 3 agents (kilo, pi, qoder) pass all 6 tests each ✅
- Rollback readiness: all Phase 10 changes confined to 5 files; git checkout rollback documented ✅

---

## Verification Results

| Check | Status | Detail |
|-------|--------|--------|
| `npx tsc --noEmit` | ✅ PASS | Zero type errors |
| `npm test` | ✅ 590/600 | 55 files pass, 10 gated skipped |
| `npm run upstream:check` | ✅ exit 0 | 23 registered, 0 stale, 234 default-resolved |
| `__tests__/adapter-contract.test.ts` | ✅ 22/22 | 6 tests × 3 agents (kilo/pi/qoder) + 4 MockAgentAPI |
| `__tests__/qoder-adapter.test.ts` | ✅ 40/40 | QoderAdapter unit tests pass |
| `__tests__/qoder-adapter-integration.test.ts` | ✅ 8/8 (+10 gated) | Integration tests pass |
| `__tests__/store-adapter.test.ts` | ✅ 30/30 | StoreAgentAdapter unit tests pass |
| special-cases.md entries | ✅ 23 | 20 original + 3 new (store-adapter, qoder-adapter, kilo-adapter) |

---

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks completed without any auto-fixes, bugs, or missing functionality.

---

## Threat Model Compliance

| Threat ID | Status | Detail |
|-----------|--------|--------|
| T-10-06 (Information Disclosure) | ✅ Accept | Test output contains workspace-local paths only, no secrets |
| T-10-07 (Denial of Service) | ✅ Accept | `upstream:check` network-dependent but manual-only trigger per D-33 |
| T-10-SC (Tampering) | ✅ Mitigated | Zero new npm packages added in this plan |

---

## Commits

| Hash | Type | Message |
|------|------|---------|
| `2e9d010` | docs | docs(10-03): add store-adapter, qoder-adapter, kilo-adapter to special-cases registry |
| `d25bddf` | docs | docs(10-03): document StoreAgentAdapter indirect test coverage in contract tests |

---

## Known Stubs

None. All registry entries are properly annotated with status/decision values. All tests pass. No TODO/FIXME/placeholder patterns introduced.

---

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. The special-cases.md registry is a documentation-only change consumed by an existing script (`scripts/upstream-divergence.ts`). The adapter-contract.test.ts comment is documentation-only.

---

## Net Code Change

| File | Before | After | Delta |
|------|--------|-------|-------|
| `skills/upstream-merge/references/special-cases.md` | 43 lines (20 entries) | 46 lines (23 entries) | +3 |
| `__tests__/adapter-contract.test.ts` | 124 lines | 128 lines | +4 |

**Net:** +7 lines across 2 files (registry entries + documentation).

---

## Self-Check: PASSED

- ✅ `skills/upstream-merge/references/special-cases.md` — 23 entries confirmed, footer updated to 2026-06-26
- ✅ `__tests__/adapter-contract.test.ts` — StoreAgentAdapter documentation comment present
- ✅ Commits `2e9d010` and `d25bddf` exist in git history
- ✅ `npm run upstream:check` exits 0 with all 3 new entries in `✓ registered`
- ✅ `npx tsc --noEmit` passes (zero errors)
- ✅ `npm test` passes (590/600, 55 files)
- ✅ Parametric contract tests pass for all 3 agents (22/22)
- ✅ QoderAdapter and KiloAdapter behavior parity confirmed
