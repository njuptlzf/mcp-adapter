---
phase: 05-type-decoupling-entry-point-refactor
plan: "05"
subsystem: entry-point / adapter-boundary
tags:
  - entry-point
  - pi-adapter
  - agent-agnostic
  - context-bridge
  - renderer-bridge
requires:
  - "05-01"
  - "05-03"
  - "05-04"
provides:
  - adapters/entry.ts
  - index.ts
  - adapters/pi-adapter.ts
  - __tests__/entry.test.ts
affects:
  - adapters/pi-adapter.ts
  - index.ts
  - vitest.config.ts
  - __tests__/pi-adapter.test.ts
tech-stack:
  added: []
  patterns:
    - Agent-agnostic createMcpAdapter entry point
    - Pi-specific wrapper delegating to generic entry point
    - ExtensionContext -> AgentContext conversion in PiAdapter
    - String renderer output -> Pi Text via piRenderWrapper
key-files:
  created:
    - adapters/entry.ts
    - __tests__/entry.test.ts
  modified:
    - index.ts
    - adapters/pi-adapter.ts
    - __tests__/pi-adapter.test.ts
    - vitest.config.ts
decisions:
  - Preserved all public exports from index.ts (mcpAdapter default, piMcpAdapter alias, agent type re-exports, resolver re-exports).
  - Moved all generic registration/lifecycle logic into adapters/entry.ts so index.ts is only a Pi-specific loader/wrapper.
  - PiAdapter now bridges generic AgentAPI calls to Pi native types by converting ExtensionContext to AgentContext and wrapping string renderers back to Pi Text.
  - Added reload propagation in adaptPiContext after discovering the generic /mcp setup handler requires it.
metrics:
  duration: "~20m"
  completed-date: "2026-06-16"
---

# Phase 05 Plan 05: Type Decoupling & Entry Point Refactor Summary

Introduced the agent-agnostic `createMcpAdapter` entry point in `adapters/entry.ts`, refactored `index.ts` into a thin Pi-specific wrapper, and updated `PiAdapter` to bridge generic `AgentContext` and Pi `ExtensionContext`/Text renderers. All existing Pi integration tests continue to pass.

## Execution Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create adapters/entry.ts with createMcpAdapter | `3179d9a` | `adapters/entry.ts` |
| 2 | Refactor index.ts as thin Pi wrapper using generic ToolInfo | `d8e3ee8` | `index.ts` |
| 3 | Add __tests__/entry.test.ts, update coverage thresholds, run integration tests | `1ec93af` | `__tests__/entry.test.ts`, `vitest.config.ts` |
| 4 | Update PiAdapter to bridge AgentContext and Pi Text renderers | `06c7088` | `adapters/pi-adapter.ts`, `__tests__/pi-adapter.test.ts` |

## Verification

- `npx tsc --noEmit` passes.
- `npx vitest run __tests__/entry.test.ts __tests__/index-lifecycle.test.ts __tests__/pi-adapter.test.ts` passes (37 tests).
- Full suite: 475 passed; only pre-existing `interactive-visualizer-server.test.ts` failures due to missing `examples/interactive-visualizer/dist/*` build artifacts (unrelated to this plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Preserved `reload` in `adaptPiContext`**
- **Found during:** Task 4 verification
- **Issue:** After adding context conversion in `PiAdapter.adaptCommand`, `__tests__/index-lifecycle.test.ts` test "triggers core reload after setup changes config" failed with `cmdCtxTyped.reload is not a function`. The generic `/mcp setup` handler in `adapters/entry.ts` calls `cmdCtxTyped.reload()`, but `adaptPiContext` was not copying `reload` from the Pi `ExtensionContext`.
- **Fix:** Added `reload: (ctx as unknown as { reload?: () => Promise<void> }).reload` to the `AgentContext` returned by `adaptPiContext`.
- **Files modified:** `adapters/pi-adapter.ts`
- **Commit:** `06c7088`

## GitNexus Impact Analysis

| Symbol | Direction | Risk | Notes |
|--------|-----------|------|-------|
| `mcpAdapter` / `index.ts` | upstream | HIGH | Expected — index.ts is the public entry point; most execution flows pass through it. Work proceeded per plan. |
| `createMcpAdapter` | upstream | (noted in prior analysis) | New symbol; no upstream callers yet by design. |
| `PiAdapter` | upstream | LOW | Only direct caller is `index.ts:mcpAdapter`. |
| `adaptPiContext` | upstream | LOW | Only direct caller is `index.ts:mcpAdapter`. |

Final `gitnexus detect-changes` returned **medium** risk, with the expected `adapters/pi-adapter.ts` changes plus unrelated pre-existing modifications to `AGENTS.md` and `CLAUDE.md`.

## Auth Gates

None.

## Known Stubs

None in files created or modified by this plan.

## Threat Flags

No new security-relevant surface outside the plan's documented trust boundaries.

## Notes

- `__tests__/index-lifecycle.test.ts` was listed in `files_modified` but did not require changes; it passes after the `adaptPiContext` fix.
- `AGENTS.md` and `CLAUDE.md` show as modified in `git status` but were not edited during this plan execution.

## Self-Check: PASSED

- [x] `adapters/entry.ts` exists
- [x] `__tests__/entry.test.ts` exists
- [x] Commits `3179d9a`, `d8e3ee8`, `1ec93af`, `06c7088` present in `git log`
- [x] `npx tsc --noEmit` passes
- [x] Required integration tests pass
