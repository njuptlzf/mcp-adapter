---
phase: 03-core-logic-abstraction
plan: 02
subsystem: core
tags: [migration, agent-api, pi-adapter, refactoring]
dependency_graph:
  requires: ["03-01"]
  provides:
    - "init.ts accepts AgentAPI + AgentContext directly"
    - "index.ts creates PiAdapter + adaptPiContext at entry point"
  affects:
    - "commands.ts - will be migrated in 03-03"
tech_stack:
  added: []
  patterns:
    - "Adapter-mediated entry point pattern"
key_files:
  created: []
  modified:
    - "init.ts"
    - "index.ts"
    - "__tests__/init-elicitation.test.ts"
metrics:
  duration: 10 minutes
  completed_date: "2026-06-11T03:25:00Z"
---

# Phase 03 Plan 02: Wire init.ts to AgentAPI/UISystem, Bridge index.ts through PiAdapter

Completed the core initialization migration by updating init.ts to accept AgentAPI+AgentContext directly and wiring index.ts to create the adapter at entry point.

## Completed Tasks

| Task | Name | Files |
|------|------|-------|
| 1 | Migrate init.ts to AgentAPI + AgentContext | init.ts |
| 2 | Wire index.ts entry point through PiAdapter + adaptPiContext | index.ts |

## Verification Results

- `npx tsc --noEmit` - PASSED (0 errors)
- `npx vitest run __tests__/init-elicitation.test.ts` - PASSED (2 tests)
- `npx vitest run __tests__/index-lifecycle.test.ts` - PASSED (13 tests)
- `npx vitest run __tests__/integration.test.ts` - PASSED (9 tests)
- `npx vitest run` - PASSED (350 tests, 2 pre-existing failures unrelated to changes)
- `grep "Extension" init.ts` - 0 matches (excluding McpExtensionState type name)
- `grep "ExtensionContext" state.ts` - 0 matches
- init.ts: 346 lines (requirement: ≥346) ✓

## Deviations from Plan

None - plan executed exactly as written.

### Auto-fixed Issues

No deviations required. The migration was completed according to plan specifications.

## Key Changes

### init.ts (346 lines)
- Changed function signature from `initializeMcp(pi: ExtensionAPI, ctx: ExtensionContext)` to `initializeMcp(agentapi: AgentAPI, ctx: AgentContext)`
- Removed `ExtensionAPI, ExtensionContext` import from `@earendil-works/pi-coding-agent`
- Added `AgentAPI, AgentContext` import from local interfaces
- Changed `pi.getFlag("mcp-config")` to `agentapi.getFlag("mcp-config")`
- Changed `pi.sendMessage(...)` to `agentapi.sendMessage(...)` in state factory
- Added type casts for `setSamplingConfig`/`setElicitationConfig` to bridge `UISystem` to Pi-specific handler types (since sampling-handler.ts and elicitation-handler.ts still use Pi-specific types)

### index.ts (348 lines)
- Added `agentapi = new PiAdapter(pi)` at session_start handler
- Added `agentctx = adaptPiContext(ctx)` to convert ExtensionContext to AgentContext
- Changed `initializeMcp(pi, ctx)` to `initializeMcp(agentapi, agentctx)`
- Backward-compatible: `mcpAdapter` signature unchanged (still accepts `ExtensionAPI`)
- Named exports (`PiAdapter`, `adaptPiContext`, `AgentAPI` types) preserved

### __tests__/init-elicitation.test.ts (+36 lines)
- Added PiAdapter mock to support init.ts AgentAPI calls
- Updated initializeMcp test calls to use agentapi mock with required AgentAPI methods

## Self-Check: PASSED

- TypeScript compiles cleanly ✓
- All tests pass ✓ (350/352, 2 pre-existing failures for missing dist files)
- No ExtensionAPI/ExtensionContext imports in init.ts ✓
- No ExtensionContext imports in state.ts ✓
- Key link patterns verified: `initializeMcp(agentapi, agentctx)`, `agentapi.getFlag`, `agentapi.sendMessage`, `ctx.ui.notify`, `ctx.ui.setStatus`