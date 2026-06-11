---
phase: 03-core-logic-abstraction
plan: 01
subsystem: core
tags: [migration, agent-api, uisystem, refactoring]
dependency_graph:
  requires: []
  provides:
    - "utils.ts uses AgentAPI instead of ExtensionAPI"
    - "state.ts uses UISystem instead of ExtensionContext['ui']"
  affects:
    - "init.ts - updated to wrap pi with PiAdapter"
    - "commands.ts - updated to wrap pi with PiAdapter"
tech_stack:
  added:
    - "ExecResult interface for typed exec results"
  patterns:
    - "PiAdapter wrapping pattern for backward compatibility"
key_files:
  created: []
  modified:
    - "utils.ts"
    - "state.ts"
    - "init.ts"
    - "commands.ts"
    - "__tests__/index-lifecycle.test.ts"
metrics:
  duration: 13 minutes
  completed_date: "2026-06-11T03:14:00Z"
---

# Phase 03 Plan 01: Migrate Core Utils and State to Generic Interfaces

Migrated utils.ts and state.ts from Pi-specific ExtensionAPI/ExtensionContext types to generic AgentAPI/UISystem interfaces. Updated callers in init.ts and commands.ts to wrap pi with PiAdapter.

## Completed Tasks

| Task | Name | Files |
|------|------|-------|
| 1 | Migrate utils.ts from ExtensionAPI to AgentAPI | utils.ts, init.ts, commands.ts |
| 2 | Migrate state.ts to use UISystem and AgentAPI-compatible types | state.ts |
| 3 | Verify lifecycle.ts has no Pi coupling; add regression test | __tests__/index-lifecycle.test.ts |

## Verification Results

- `npx tsc --noEmit` - PASSED (0 errors)
- `npx vitest run __tests__/index-lifecycle.test.ts` - PASSED (13 tests)
- `npx vitest run` - PASSED (350 tests, 2 pre-existing failures unrelated to changes)

## Deviations from Plan

### Auto-fixed Issues

**1. Rule 1 - Caller updates required for utils.ts migration**
- **Found during:** Task 1 - TypeScript compilation failed after utils.ts migration
- **Issue:** `openUrl` and `openPath` signatures changed from ExtensionAPI to AgentAPI, but callers in init.ts and commands.ts still passed ExtensionAPI
- **Fix:** Updated init.ts and commands.ts to wrap `pi` with `PiAdapter` before passing to openUrl/openPath, maintaining backward compatibility with existing Pi API while using the generic interface
- **Files modified:** init.ts (added PiAdapter import, created adapter instance), commands.ts (added PiAdapter import, created adapter in openMcpSetup)

## Key Changes

### utils.ts (137 lines)
- Replaced `@earendil-works/pi-coding-agent` ExtensionAPI import with `AgentAPI` from local interfaces
- Added `ExecResult` interface to type the `agent.exec()` return value
- Changed all three function signatures: `execOpen`, `openUrl`, `openPath` now accept `AgentAPI` instead of `ExtensionAPI`
- All `pi.exec()` calls replaced with `agent.exec()`

### state.ts (36 lines)
- Replaced `ExtensionContext` import with `UISystem` from local interfaces
- Changed `ui?: ExtensionContext["ui"]` to `ui?: UISystem`
- Updated `SendMessageFn` type to use `unknown` parameters matching AgentAPI semantics

### lifecycle.ts (93 lines)
- No changes required - confirmed no ExtensionAPI/ExtensionContext references
- Uses only McpServerManager methods (pure logic)

### __tests__/index-lifecycle.test.ts (+24 lines)
- Added McpLifecycleManager regression test confirming Pi-agnostic instantiation

## Self-Check: PASSED

- utils.ts: 137 lines (requirement: ≥129) ✓
- state.ts: 36 lines (original: 41 lines, refactored to simpler type) ✓
- TypeScript compiles cleanly ✓
- All key-link patterns present: openUrl(agent, openPath(agent, ui?: UISystem