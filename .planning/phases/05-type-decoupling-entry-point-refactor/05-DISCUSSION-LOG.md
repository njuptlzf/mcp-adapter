# Phase 5: Type Decoupling & Entry Point Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 05-type-decoupling-entry-point-refactor
**Areas discussed:** Entry point API design

---

## Entry point API design

| Option | Description | Selected |
|--------|-------------|----------|
| `createMcpAdapter(agentapi, ctx)` in a new file | Add `adapters/entry.ts`, provide `createMcpAdapter(agentapi: AgentAPI, ctx: AgentContext)`. `index.ts` becomes a thin Pi wrapper. | ✓ |
| `initializeMcpAdapter(agentapi, ctx)` in `init.ts` | Put the universal entry next to `init.ts`, delegate from `index.ts`. | |
| Dual exports in `index.ts` | Export both `mcpAdapter(pi)` and `createMcpAdapter(agentapi)` from `index.ts`. | |
| Defer to Phase 6 | Only guarantee `index.ts` uses `PiAdapter`; decide the universal entry later. | |

**User's choice:** `createMcpAdapter(agentapi, ctx)` in a new file.
**Notes:** User wants non-Pi agents to import a clean universal entry directly, while keeping the Pi default export unchanged.

---

## createMcpAdapter return value

| Option | Description | Selected |
|--------|-------------|----------|
| Return `void` | Only registers tools/commands; cleanup handled by session events / graceful shutdown. | ✓ |
| Return shutdown function | Return `() => Promise<void>` for explicit cleanup. | |
| Return controller object | Return `{ shutdown; state }` exposing internal state. | |

**User's choice:** Return `void`.
**Notes:** Matches current `index.ts` behavior; lifecycle remains event-driven.

---

## Config loading responsibility

| Option | Description | Selected |
|--------|-------------|----------|
| Caller passes loaded config/cache | `createMcpAdapter(agentapi, ctx, config, cache)` receives already-loaded values. | ✓ |
| Entry loads internally | `createMcpAdapter` calls `loadMcpConfig` and `loadMetadataCache` itself. | |
| Optional pass-or-load | Accept options object with optional config/cache/configPath. | |

**User's choice:** Caller passes loaded config/cache.
**Notes:** Keeps entry predictable and testable; `index.ts` retains early config loading at module top level.

---

## Entry file location

| Option | Description | Selected |
|--------|-------------|----------|
| `adapters/entry.ts` | Co-located with `PiAdapter` in `adapters/`. | ✓ |
| `mcp-adapter.ts` | Root-level generic entry file. | |
| `adapter-entry.ts` | Root-level with explicit name. | |

**User's choice:** `adapters/entry.ts`.
**Notes:** Keeps adapter-layer code together.

---

## the agent's Discretion

- Exact internal helper organization inside `adapters/entry.ts`.
- Specific type-replacement strategies for Pi-coupled types (`AgentToolResult`, `AgentToolUpdateCallback`, `ExtensionContext`, `ExtensionUIContext`, `ToolInfo`, `Model`, `complete`, `AssistantMessage`, pi-tui `Text`).
- Whether to extend `UISystem` with an optional `confirm` method or map elicitation confirmation onto `notify`/`form` in the Pi adapter.

## Deferred Ideas

- Phase 6 non-Pi adapter (e.g., `QoderAdapter`) consuming `createMcpAdapter`.
- Phase 7 rebuild of `skills/mcp-adapter-test` for per-adapter verification.
- Phase 8 upstream-merge manifest and skill.
