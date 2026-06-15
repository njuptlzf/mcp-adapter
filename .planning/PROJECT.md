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

## Current Milestone: v2.0 — Multi-Agent Adapter Completion

**Goal:** Complete "for every agent" transformation — decouple all remaining Pi type bindings, add at least one non-Pi agent adapter, rebuild integration test as agent-agnostic, and update `README.md` to clearly communicate that the project remains fully Pi-compatible while supporting every agent.

**Target phases:**
- Phase 5 — Type Decoupling & Entry Point Refactor: Replace Pi types in 6 source files, add agent-agnostic entry point
- Phase 6 — Second Agent Adapter: Implement non-Pi AgentAPI adapter, prove portability
- Phase 7 — Integration Test Rebuild: Rebuild skill as "for every agent" with per-adapter verification; revise `README.md` to highlight Pi compatibility + universal agent support + integration test verification results

## Current State

**Milestone v1.0 complete (4 phases, 7 plans)** — Internal interfaces abstracted (AgentAPI/UISystem/PiAdapter), init.ts/core logic migrated to AgentAPI. However:
- `index.ts` still accepts `ExtensionAPI` (blocks non-Pi agents)
- 6 source files still import Pi types (`AgentToolResult`, `ExtensionUIContext`, etc.)
- Only one adapter implementation (`PiAdapter`) in `adapters/`
- `agent-dir.ts` hardcodes `PI_CODING_AGENT_DIR`
- Integration test skill only validates against Pi mock

Test suite: 350/352 pass.

## Validated Requirements

- REQ-01 (Generic AgentAPI Interface) — Validated in Phase 01: `interfaces/agent-api.ts`; Phase 03: `utils.ts`/`init.ts`/`commands.ts` accept AgentAPI
- REQ-02 (UI System Interface) — Validated in Phase 01: `interfaces/agent-api.ts`; Phase 03: `state.ts`/`commands.ts` use UISystem
- REQ-03 (Pi Adapter Implementation) — Validated in Phase 01: `adapters/pi-adapter.ts`; Phase 03: `index.ts` wires PiAdapter + adaptPiContext internally
- REQ-04 (Backward Compatibility) — Validated in Phase 01: `index.ts` default `mcpAdapter` unchanged, `piMcpAdapter` alias added; Phase 03: activate signature preserved
- REQ-05 (Dependency Restructuring) — Validated in Phase 01: `package.json` peer/optional deps; Phase 02: `AgentPathResolver` abstraction lets non-Pi agents supply their own global config path
- REQ-06 (Documentation) — Validated in Phase 01: `MAPPING.md`
- REQ-07 (Testing) — Validated in Phase 01: `__tests__/pi-adapter.test.ts` + `__tests__/integration.test.ts`; Phase 02: `__tests__/agent-paths.test.ts` + `__tests__/agent-paths-integration.test.ts`; Phase 03: regression test for McpLifecycleManager Pi-coupling check

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone:**
1. Full review of all sections
2. Core Value check
3. Audit Out of Scope
4. Update Context with current state

---
Last updated: 2026-06-15