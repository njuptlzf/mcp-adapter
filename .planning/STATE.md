---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-05-PLAN.md; phase verification pending
last_updated: "2026-06-16T12:58:00+08:00"
last_activity: 2026-06-16 — 05-05 entry point refactor complete
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 18
  completed_plans: 17
  percent: 67
---

# Project State

**Created:** 2026-06-10T13:45:00+08:00
**Last updated:** 2026-06-16T12:11:31+08:00
**Status:** Planning — Milestone v2.0 started

## Current Position

Phase: 05-type-decoupling-entry-point-refactor
Plan: 05-05 complete; phase verification pending
Status: Phase 5 Wave 3 complete; entry point refactor and Pi adapter bridging done
Last activity: 2026-06-16 — 05-05 entry point refactor + PiAdapter context/renderer bridge complete

## Recent Progress

### Milestone v1.0 — Complete (4 phases, 7 plans)

- Phase 1: Foundation — AgentAPI/UISystem interfaces, PiAdapter, MAPPING.md
- Phase 2: Dependency Restructuring — AgentPathResolver, config.ts rewired
- Phase 3: Core Logic Abstraction — init.ts/commands.ts migrated to AgentAPI
- Phase 4: Testing & Verification — mock adapter + contract tests + coverage

### Phase 5 — Type Decoupling & Entry Point Refactor

- 05-00: Wave 0 stubs and validation update complete
- 05-01: Complete
- 05-02: agent-dir env decoupling + integration tests complete
- 05-03: sampling subsystem decoupled via SamplingProvider / PiSamplingProvider
- 05-04: elicitation and rendering decoupled behind UISystem / RenderOutput with Pi renderer
- 05-05: agent-agnostic createMcpAdapter entry point + Pi wrapper + PiAdapter context/renderer bridge complete

## Next Actions

**Phase 5 — Type Decoupling & Entry Point Refactor:** Run phase verification and finalize phase.

Requirements satisfied: DECOUPLE-04, ENTRY-01, ENTRY-02, ENTRY-03
Affected files: index.ts, adapters/pi-adapter.ts, adapters/entry.ts, __tests__/entry.test.ts, __tests__/pi-adapter.test.ts, vitest.config.ts

Run `/gsd-execute-phase 05-type-decoupling-entry-point-refactor` to continue with phase verification.

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

### Sampling Provider Injection (05-03)

- `AgentContext.samplingProvider?: SamplingProvider` allows agents to opt into MCP sampling
- `PiSamplingProvider` is the only sampling boundary importing `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`
- `init.ts` only advertises sampling when `ctx.samplingProvider` is present

### Path Resolution (Phase 2)

- `AgentPathResolver` contract in `interfaces/agent-paths.ts`
- `createPiResolver` factory + `DEFAULT_AGENT_RESOLVER` constant
- `getPiGlobalConfigPath` retained as backward-compat wrapper around `resolveAgentGlobalConfigPath`
- `getAgentDir` now reads `MCP_AGENT_DIR` first, with `PI_CODING_AGENT_DIR` as backward-compatible fallback (05-02)

### Core Logic Migration (Phase 3)

- `utils.ts` / `state.ts` / `lifecycle.ts` / `init.ts` / `commands.ts` / `mcp-panel.ts` / `mcp-setup-panel.ts` migrated from `ExtensionAPI` / `ExtensionContext` to generic `AgentAPI` / `AgentContext` / `UISystem`
- `index.ts` creates `PiAdapter` and `adaptPiContext` internally at entry point
- `activate` signature unchanged for Pi backward compat

### Entry Point Decoupling (05-05)

- `adapters/entry.ts` exports agent-agnostic `createMcpAdapter(agentapi, ctx, config, cache)`
- `index.ts` is now a thin Pi-specific wrapper that loads config/cache, constructs `PiAdapter`, adapts context, and delegates to `createMcpAdapter`
- `PiAdapter` converts Pi `ExtensionContext` to `AgentContext` for tools, commands, and session events
- `PiAdapter` wraps string `renderCall`/`renderResult` outputs back to Pi `Text` via `piRenderWrapper`
- Public exports preserved: `mcpAdapter` default, `piMcpAdapter` alias, agent types, path resolvers

---

## Session Tracking

**Last session:** 2026-06-16T12:58:00+08:00
**Stopped at:** Completed 05-05-PLAN.md; phase verification pending
