---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-02-PLAN.md; next 05-03-PLAN.md
last_updated: "2026-06-16T11:37:00+08:00"
last_activity: 2026-06-16 — 05-02 agent-dir env decoupling + integration tests complete
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 18
  completed_plans: 15
  percent: 56
---

# Project State

**Created:** 2026-06-10T13:45:00+08:00
**Last updated:** 2026-06-15T12:00:00+08:00
**Status:** Planning — Milestone v2.0 started

## Current Position

Phase: 05-type-decoupling-entry-point-refactor
Plan: 05-02 complete; next 05-03
Status: Phase 5 Wave 1 in progress; 05-02 agent-dir env decoupling complete
Last activity: 2026-06-16 — 05-02 agent-dir env decoupling + integration tests complete

## Recent Progress

### Milestone v1.0 — Complete (4 phases, 7 plans)

- Phase 1: Foundation — AgentAPI/UISystem interfaces, PiAdapter, MAPPING.md
- Phase 2: Dependency Restructuring — AgentPathResolver, config.ts rewired
- Phase 3: Core Logic Abstraction — init.ts/commands.ts migrated to AgentAPI
- Phase 4: Testing & Verification — mock adapter + contract tests + coverage

## Next Actions

**Phase 5 — Type Decoupling & Entry Point Refactor:** Plans finalized

Requirements: DECOUPLE-01~07, ENTRY-01~03
Affected files: proxy-modes.ts, direct-tools.ts, tool-result-renderer.ts, sampling-handler.ts, elicitation-handler.ts, index.ts, agent-dir.ts, adapters/entry.ts, adapters/pi-renderer.ts, adapters/pi-sampling-provider.ts, interfaces/sampling.ts

Run `/gsd-execute-phase 05-type-decoupling-entry-point-refactor` to begin execution.

---

## Decisions & Preferences

### AgentAPI Interface (Phase 1)

- `sendMessage(message: unknown, options?: unknown)` - Flexible types for cross-agent compatibility
- `exec(command: string, args: string[])` returns `Promise<unknown>`
- All methods required, no optional agent methods

### UISystem Interface (Phase 1)

- `notify` required, all other methods optional
- `form` and `custom` may not exist in other agents
- `theme.fg` is optional

### Dependency Strategy (Phase 1)

- `@earendil-works/pi-coding-agent` → optional peerDependency
- `@earendil-works/pi-ai`, `@earendil-works/pi-tui` → optionalDependencies

### Adapter Architecture (Phase 1)

- Sampling / elicitation kept in core with adapter abstraction
- Backward compatibility maintained through existing `mcpAdapter` export + `piMcpAdapter` alias

### Path Resolution (Phase 2)

- `AgentPathResolver` contract in `interfaces/agent-paths.ts`
- `createPiResolver` factory + `DEFAULT_AGENT_RESOLVER` constant
- `getPiGlobalConfigPath` retained as backward-compat wrapper around `resolveAgentGlobalConfigPath`
- `getAgentDir` now reads `MCP_AGENT_DIR` first, with `PI_CODING_AGENT_DIR` as backward-compatible fallback (05-02)

### Core Logic Migration (Phase 3)

- `utils.ts` / `state.ts` / `lifecycle.ts` / `init.ts` / `commands.ts` / `mcp-panel.ts` / `mcp-setup-panel.ts` migrated from `ExtensionAPI` / `ExtensionContext` to generic `AgentAPI` / `AgentContext` / `UISystem`
- `index.ts` creates `PiAdapter` and `adaptPiContext` internally at entry point
- `activate` signature unchanged for Pi backward compat

---

## Session Tracking

**Last session:** 2026-06-16T11:37:00+08:00
**Stopped at:** Completed 05-02-PLAN.md; next 05-03-PLAN.md
