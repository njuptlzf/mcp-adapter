---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: planning
stopped_at: Phase 5 context gathered
last_updated: "2026-06-15T07:25:59.921Z"
last_activity: 2026-06-15 — Milestone v2.0 initialized
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 7
  completed_plans: 7
  percent: 50
---

# Project State

**Created:** 2026-06-10T13:45:00+08:00
**Last updated:** 2026-06-15T12:00:00+08:00
**Status:** Planning — Milestone v2.0 started

## Current Position

Phase: Requirements defined (Phase 5-7 pending)
Plan: —
Status: Defining requirements complete, ready for phase planning
Last activity: 2026-06-15 — Milestone v2.0 initialized

## Recent Progress

### Milestone v1.0 — Complete (4 phases, 7 plans)

- Phase 1: Foundation — AgentAPI/UISystem interfaces, PiAdapter, MAPPING.md
- Phase 2: Dependency Restructuring — AgentPathResolver, config.ts rewired
- Phase 3: Core Logic Abstraction — init.ts/commands.ts migrated to AgentAPI
- Phase 4: Testing & Verification — mock adapter + contract tests + coverage

## Next Actions

**Phase 5 — Type Decoupling & Entry Point Refactor:** Ready to plan

Requirements: DECOUPLE-01~07, ENTRY-01~03
Affected files: proxy-modes.ts, direct-tools.ts, tool-result-renderer.ts, sampling-handler.ts, elicitation-handler.ts, index.ts, agent-dir.ts

Run `/gsd-plan-phase 5` to create detailed execution plan.

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

### Core Logic Migration (Phase 3)

- `utils.ts` / `state.ts` / `lifecycle.ts` / `init.ts` / `commands.ts` / `mcp-panel.ts` / `mcp-setup-panel.ts` migrated from `ExtensionAPI` / `ExtensionContext` to generic `AgentAPI` / `AgentContext` / `UISystem`
- `index.ts` creates `PiAdapter` and `adaptPiContext` internally at entry point
- `activate` signature unchanged for Pi backward compat

---

## Session Tracking

**Last session:** 2026-06-15T07:25:59.913Z
**Stopped at:** Phase 5 context gathered
