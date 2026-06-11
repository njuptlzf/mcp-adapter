---
phase: 03-core-logic-abstraction
plan: 03
subsystem: core
tags: [migration, agent-api, uisystem, commands]
dependency_graph:
  requires: ["03-02"]
  provides:
    - "commands.ts uses AgentContext+AgentAPI"
    - "mcp-panel.ts/mcp-setup-panel.ts confirmed AgentContext-agnostic"
  affects:
    - "index.ts - pre-existing AgentAPI type mismatch"
tech_stack:
  added: []
  patterns:
    - "type cast bridge for UISystem.renderer unknown -> tui type"
key_files:
  created: []
  modified:
    - "commands.ts"
    - "mcp-panel.ts (verified, no changes needed)"
    - "mcp-setup-panel.ts (verified, no changes needed)"
decisions:
  - "Equivocated generic UISystem.renderer output to tui with explicit type casts at each call site — explicit and localized instead of altering the UISystem type spec"
  - "pi.getFlag migrated to agentapi.getFlag; PiAdapter no longer constructed inside commands.ts"
metrics:
  duration: 8 minutes
  completed_date: "2026-06-11T04:31:18Z"
---

# Phase 03 Plan 03: Migrate commands.ts and Panel Entry Points to AgentContext+UISystem

Migrated commands.ts from Pi-specific ExtensionContext/ExtensionAPI types to generic AgentContext+AgentAPI interfaces. Confirmed panel files (mcp-panel.ts, mcp-setup-panel.ts) already require no Extension types and need no changes.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate commands.ts from ExtensionContext to AgentContext | b5afa96 | commands.ts |
| 2 | Migrate panel entry points | (no changes) | mcp-panel.ts, mcp-setup-panel.ts |

## Verification Results

- `npx vitest run __tests__/commands-onboarding.test.ts` - PASSED (4 tests)
- `npx vitest run __tests__/index-lifecycle.test.ts` - PASSED (13 tests)
- `npx vitest run` - 350 tests passed, 2 pre-existing failures (interactive-visualizer-server.js missing)
- `npx tsc --noEmit` - commands.ts clean; 3 pre-existing errors in `index.ts` (not in scope — `index.ts` last modified in 03-02)
- `grep "Extension" commands.ts` - 0 matches of ExtensionAPI/ExtensionContext (McpExtensionState is a local composite type, not an import)
- `grep "Extension" mcp-panel.ts` - 0 matches
- `grep "Extension" mcp-setup-panel.ts` - 0 matches

## Deviations from Plan

### Auto-fixed Issues

**1. Rule 1 - Bug: UISystem.custom renderer type mismatch with tui type**
- **Found during:** Task 1 - TypeScript compilation after signature migration
- **Issue:** UISystem.UIRenderer returns `unknown`, but `createMcpPanel`/`createMcpSetupPanel` expect `tui: { requestRender(): void }`. The generic `(tui, _theme, _keybindings, done)` parameters are `unknown`.
- **Fix:** Added explicit type casts at the three `ctx.ui.custom` call sites in commands.ts:
  - `tui as { requestRender(): void }`
  - `done as (result?: unknown) => void`
- **Files modified:** commands.ts (lines 290, 362, 407)
- **Commit:** b5afa96

## Known Stubs

None — no stubbed data sources introduced in this plan.

## Self-Check: PASSED

- commands.ts: 422 lines (requirement: ≥420) ✓
- `ExtensionAPI`/`ExtensionContext` imports removed ✓
- All ctx.ui calls through UISystem ✓
- pi.getFlag migrated to agentapi.getFlag ✓
- Panel entry points pass AgentContext/AgentAPI ✓ (no changes needed)
- Commands tests pass (4/4) ✓
- Lifecycle tests pass (13/13) ✓
- Full suite baseline maintained (349 passes baseline → 350/352 passes with 2 pre-existing failures) ✓
- Key link patterns verified: `showStatus(state, ctx)`, `showTools(state, ctx)`, `authenticateServer(name, config, ctx)`, `logoutServer(name, state, ctx)`, `openMcpSetup(state, agentapi, ctx)`, `openMcpPanel(state, agentapi, ctx)`, `openMcpAuthPanel(state, agentapi, ctx)`, `ctx.ui.custom(...)`
