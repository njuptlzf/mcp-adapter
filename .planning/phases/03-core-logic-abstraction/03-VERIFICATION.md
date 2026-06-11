---
phase: 03-core-logic-abstraction
verified: 2026-06-11T12:45:00Z
status: gaps_found
re_verification: null
score: 10/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "TypeScript compiles cleanly (0 errors)"
    status: failed
    reason: "index.ts passes `pi` (ExtensionAPI) to commands.ts functions that now expect AgentAPI"
    artifacts:
      - path: "index.ts"
        issue: "Lines 198, 218, 254 pass `pi` to openMcpSetup/openMcpPanel/openMcpAuthPanel which now require AgentAPI"
    missing:
      - "Change `openMcpSetup(state, pi, ctx, ...)` to `openMcpSetup(state, agentapi, ctx, ...)` on line 198"
      - "Change `openMcpPanel(state, pi, ctx, ...)` to `openMcpPanel(state, agentapi, ctx, ...)` on line 218"
      - "Change `openMcpAuthPanel(state, pi, ctx, ...)` to `openMcpAuthPanel(state, agentapi, ctx, ...)` on line 254"
human_verification: []
---

# Phase 03: Core Logic Abstraction Verification Report

**Phase Goal:** Migrate core logic (init.ts, utils.ts, commands.ts, state.ts, lifecycle.ts, mcp-panel.ts, mcp-setup-panel.ts) from ExtensionAPI/ExtensionContext to AgentAPI/AgentContext/UISystem, with index.ts wiring PiAdapter internally. Backward compatibility preserved.

**Verified:** 2026-06-11T12:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | utils.ts accepts AgentAPI in all function signatures | ✓ VERIFIED | Line 28: `openUrl(agent: AgentAPI, ...)` ✓; Line 35: `openPath(agent: AgentAPI, ...)` ✓; Line 11: `execOpen(agent: AgentAPI, ...)` ✓ |
| 2 | state.ts uses UISystem for ui? field | ✓ VERIFIED | Line 34: `ui?: UISystem` (migrated from `ui?: ExtensionContext["ui"]`) |
| 3 | state.ts uses AgentAPI-compatible types for sendMessage | ✓ VERIFIED | Lines 18-21: `SendMessageFn = (message: unknown, options?: unknown) => void` |
| 4 | lifecycle.ts has zero ExtensionAPI/ExtensionContext references | ✓ VERIFIED | No imports from pi-coding-agent; uses only McpServerManager methods |
| 5 | init.ts initializeMcp accepts AgentAPI + AgentContext | ✓ VERIFIED | Line 28-31: `initializeMcp(agentapi: AgentAPI, ctx: AgentContext)` |
| 6 | init.ts routes pi interactions through AgentAPI/UI | ✓ VERIFIED | Line 32: `agentapi.getFlag(...)` ✓; Line 74: `agentapi.sendMessage(...)` ✓; `ctx.ui.notify/setStatus` ✓ |
| 7 | index.ts creates PiAdapter + adaptPiContext internally | ✓ VERIFIED | Lines 122-124: `const agentapi = new PiAdapter(pi); const agentctx = adaptPiContext(ctx);` |
| 8 | commands.ts accepts AgentContext in all function signatures | ✓ VERIFIED | All functions updated (showStatus, showTools, authenticateServer, openMcpSetup, openMcpPanel, openMcpAuthPanel) |
| 9 | commands.ts routes ctx.ui.* through UISystem | ✓ VERIFIED | Multiple `ctx.ui.notify()` and `ctx.ui.setStatus()` calls work with UISystem type |
| 10 | mcp-panel.ts and mcp-setup-panel.ts use AgentContext+AgentAPI | ✓ VERIFIED | No ExtensionAPI/ExtensionContext imports; no changes needed (they receive context through commands.ts) |
| 11 | All existing tests pass; no new failures | ✓ VERIFIED | 350/352 tests pass (2 pre-existing failures in interactive-visualizer-server.test.ts unrelated) |
| 12 | TypeScript compiles cleanly | ✗ FAILED | 3 errors in index.ts (lines 198, 218, 254) |

**Score:** 10/11 truths verified (TypeScript compilation fails due to gap)

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| REQ-01 | Plan 01, Plan 02, Plan 03 | ✓ SATISFIED | AgentAPI interface used throughout core logic |
| REQ-02 | Plan 03 | ✓ SATISFIED | UISystem interface used in state.ts and commands.ts |
| REQ-03 | Plan 02 | ✓ SATISFIED | PiAdapter implemented in adapters/pi-adapter.ts |
| REQ-04 | Plan 02 | ✓ SATISFIED | mcpAdapter signature unchanged (accepts ExtensionAPI), backward-compat alias piMcpAdapter present |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| utils.ts | AgentAPI-compatible openUrl/openPath | ✓ VERIFIED | 137 lines, `openUrl(agent: AgentAPI, ...)`, `openPath(agent: AgentAPI, ...)` |
| state.ts | UISystem-typed state fields | ✓ VERIFIED | 36 lines, `ui?: UISystem`, `SendMessageFn` uses `unknown` params |
| lifecycle.ts | No Pi coupling | ✓ VERIFIED | 93 lines, no ExtensionAPI/ExtensionContext references |
| init.ts | AgentAPI+AgentContext based initialization | ✓ VERIFIED | 346 lines, `initializeMcp(agentapi: AgentAPI, ctx: AgentContext)` |
| commands.ts | AgentContext-based command handlers | ✓ VERIFIED | 420 lines, all functions accept AgentContext |
| mcp-panel.ts | Panel using AgentContext | ✓ VERIFIED | 826 lines, no Pi-specific imports |
| mcp-setup-panel.ts | Setup panel using AgentContext | ✓ VERIFIED | 576 lines, no Pi-specific imports |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| utils.ts | AgentAPI | `agent` parameter | ✓ WIRED | `openUrl(agent: AgentAPI, ...)`, `openPath(agent: AgentAPI, ...)` |
| state.ts | UISystem | `ui?` field type | ✓ WIRED | Type changed to `ui?: UISystem` |
| init.ts | AgentAPI | `agentapi.getFlag/sendMessage` | ✓ WIRED | Lines 32, 74 use agentapi methods |
| init.ts | UISystem | `ctx.ui.notify/setStatus` | ✓ WIRED | Multiple calls verified |
| index.ts | init.ts | PiAdapter → initializeMcp | ⚠️ PARTIAL | PiAdapter created correctly, but wrong variable passed to functions |
| commands.ts | UISystem | `ctx.ui.notify/setStatus/custom` | ✓ WIRED | All UI calls verified |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npx tsc --noEmit` | 3 errors in index.ts | ✗ FAILED |
| Full test suite | `npx vitest run` | 350 passed, 2 failed (pre-existing) | ✓ PASS |
| Utils tests | `npx vitest run __tests__/utils.test.ts` | Tests pass | ✓ PASS |
| Lifecycle tests | `npx vitest run __tests__/index-lifecycle.test.ts` | 13 tests pass | ✓ PASS |
| Init elicitation tests | `npx vitest run __tests__/init-elicitation.test.ts` | 2 tests pass | ✓ PASS |
| Commands onboarding tests | `npx vitest run __tests__/commands-onboarding.test.ts` | 4 tests pass | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| index.ts | 198 | Passing `pi` (ExtensionAPI) where AgentAPI expected | 🛑 Blocker | TypeScript error TS2345 |
| index.ts | 218 | Passing `pi` (ExtensionAPI) where AgentAPI expected | 🛑 Blocker | TypeScript error TS2345 |
| index.ts | 254 | Passing `pi` (ExtensionAPI) where AgentAPI expected | 🛑 Blocker | TypeScript error TS2345 |

No TODO/FIXME/placeholder comments found in core migrated files.

### Human Verification Required

None — all verification completed programmatically.

### Gaps Summary

**Critical Gap: Type mismatch in index.ts command handler calls**

Three TypeScript errors prevent clean compilation:

1. **Line 198**: `openMcpSetup(state, pi, ctx, ...)` passes `pi: ExtensionAPI` but function expects `agentapi: AgentAPI`
2. **Line 218**: `openMcpPanel(state, pi, ctx, ...)` passes `pi: ExtensionAPI` but function expects `agentapi: AgentAPI`  
3. **Line 254**: `openMcpAuthPanel(state, pi, ctx, ...)` passes `pi: ExtensionAPI` but function expects `agentapi: AgentAPI`

The adapter infrastructure (`PiAdapter`, `adaptPiContext`) is correctly built and used in `initializeMcp`, but the command handlers for `/mcp setup`, `/mcp status`, and `/mcp-auth` still pass the raw `pi` object instead of the wrapped `agentapi`.

**Fix required:**
Replace `pi` with `agentapi` in the three function calls:
- Line 198: `openMcpSetup(state, agentapi, ctx, earlyConfigPath, "setup")`
- Line 218: `openMcpPanel(state, agentapi, ctx, earlyConfigPath)`
- Line 254: `openMcpAuthPanel(state, agentapi, ctx, earlyConfigPath)`

---

_Verified: 2026-06-11T12:45:00Z_
_Verifier: the agent (gsd-verifier)_