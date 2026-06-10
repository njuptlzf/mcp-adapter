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

**Phase 01 (universal-adapter) complete** — Generic `AgentAPI` and `UISystem` interfaces defined, `PiAdapter` class wrapping `ExtensionAPI` with `adaptPiContext` conversion, MAPPING.md documentation, `pi-coding-agent` moved to optional `peerDependency`, `pi-ai`/`pi-tui` to `optionalDependencies`. 22 new tests passing. `mcpAdapter` default export unchanged — full backward compat preserved.

## Validated Requirements

- REQ-01 (Generic AgentAPI Interface) — Validated in Phase 01: `interfaces/agent-api.ts`
- REQ-02 (UI System Interface) — Validated in Phase 01: `interfaces/agent-api.ts`
- REQ-03 (Pi Adapter Implementation) — Validated in Phase 01: `adapters/pi-adapter.ts`
- REQ-04 (Backward Compatibility) — Validated in Phase 01: `index.ts` default `mcpAdapter` unchanged, `piMcpAdapter` alias added
- REQ-05 (Dependency Restructuring) — Validated in Phase 01: `package.json` peer/optional deps
- REQ-06 (Documentation) — Validated in Phase 01: `MAPPING.md`
- REQ-07 (Testing) — Validated in Phase 01: `__tests__/pi-adapter.test.ts` + `__tests__/integration.test.ts`

---
Last updated: 2026-06-10