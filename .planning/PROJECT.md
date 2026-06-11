# Universal MCP Adapter

## Vision

Refactor the Pi-specific MCP adapter into a universal, agent-agnostic adapter that can work with multiple coding agents while maintaining backward compatibility with Pi.

## Background

The current `pi-mcp-adapter` is tightly coupled to Pi coding agent's ecosystem:
- Imports types from `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`
- Uses Pi-specific APIs: `pi.registerTool`, `pi.on`, `pi.exec`, `ctx.ui.notify`, etc.
- Has Pi-specific configuration paths and UI integration patterns

## Goal

Create a universal adapter architecture:
1. Define generic `AgentAPI` and `UISystem` interfaces
2. Implement Pi adapter as one implementation among many
3. Enable future adapters for Claude, Cursor, and other agents
4. Maintain full backward compatibility for existing Pi users

## Core Principles

- **Zero-risk refactoring**: Core MCP logic remains unchanged, only adapter layer added
- **Easy upstream updates**: Clean separation allows merging upstream changes without conflicts
- **Gradual migration**: Existing code works as-is, new features use generic interfaces

## Current State

**Phase 03 (core-logic-abstraction) complete** — `utils.ts`/`state.ts`/`lifecycle.ts`/`init.ts`/`commands.ts`/`mcp-panel.ts`/`mcp-setup-panel.ts` migrated from `ExtensionAPI`/`ExtensionContext` to generic `AgentAPI`/`AgentContext`/`UISystem`; `index.ts` creates `PiAdapter` and `adaptPiContext` internally at entry point. `activate` signature unchanged for Pi backward compat. Full suite 350/352 pass (2 pre-existing `interactive-visualizer-server` failures unrelated).

**Phase 02 (dependency-restructuring) complete** — `AgentPathResolver` contract in `interfaces/agent-paths.ts` (with `createPiResolver` factory, `DEFAULT_AGENT_RESOLVER`, `resolveAgentGlobalConfigPath`); `config.ts` rewired to thread resolver through `getConfigSources` while `getPiGlobalConfigPath` remains as backward-compat wrapper. 7 new tests (4 unit + 3 integration), full suite 349/351 pass (2 pre-existing `interactive-visualizer-server` failures unrelated). New exports surfaced in `index.ts`: `DEFAULT_AGENT_RESOLVER`, `createPiResolver`, `resolveAgentGlobalConfigPath`, `AgentPathResolver`, `AgentId`. Pi users see zero behavior change.

## Validated Requirements

- REQ-01 (Generic AgentAPI Interface) — Validated in Phase 01: `interfaces/agent-api.ts`; Phase 03: `utils.ts`/`init.ts`/`commands.ts` accept AgentAPI
- REQ-02 (UI System Interface) — Validated in Phase 01: `interfaces/agent-api.ts`; Phase 03: `state.ts`/`commands.ts` use UISystem
- REQ-03 (Pi Adapter Implementation) — Validated in Phase 01: `adapters/pi-adapter.ts`; Phase 03: `index.ts` wires PiAdapter + adaptPiContext internally
- REQ-04 (Backward Compatibility) — Validated in Phase 01: `index.ts` default `mcpAdapter` unchanged, `piMcpAdapter` alias added; Phase 03: activate signature preserved
- REQ-05 (Dependency Restructuring) — Validated in Phase 01: `package.json` peer/optional deps; Phase 02: `AgentPathResolver` abstraction lets non-Pi agents supply their own global config path
- REQ-06 (Documentation) — Validated in Phase 01: `MAPPING.md`
- REQ-07 (Testing) — Validated in Phase 01: `__tests__/pi-adapter.test.ts` + `__tests__/integration.test.ts`; Phase 02: `__tests__/agent-paths.test.ts` + `__tests__/agent-paths-integration.test.ts`; Phase 03: regression test for McpLifecycleManager Pi-coupling check

---
Last updated: 2026-06-11