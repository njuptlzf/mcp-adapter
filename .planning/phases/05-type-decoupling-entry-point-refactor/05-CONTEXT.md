# Phase 5: Type Decoupling & Entry Point Refactor - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Decouple all remaining Pi type imports across 6 source files (`proxy-modes.ts`, `direct-tools.ts`, `tool-result-renderer.ts`, `sampling-handler.ts`, `elicitation-handler.ts`, `index.ts`) and replace the hardcoded Pi agent directory in `agent-dir.ts`. Create a new agent-agnostic entry point so non-Pi agents can initialize the MCP adapter without touching Pi-specific types. Refactor the existing `mcpAdapter(pi: ExtensionAPI)` as a Pi-specific wrapper around the new entry point, preserving 100% backward compatibility for existing Pi users.

</domain>

<decisions>
## Implementation Decisions

### Agent-Agnostic Entry Point
- **D-01:** The new universal entry point lives in `adapters/entry.ts`.
- **D-02:** The exported function is named `createMcpAdapter`.
- **D-03:** Signature: `createMcpAdapter(agentapi: AgentAPI, ctx: AgentContext, config: McpConfig, cache: MetadataCache): void`.
- **D-04:** `createMcpAdapter` returns `void`. Lifecycle cleanup remains tied to session events / graceful shutdown, matching the current `index.ts` behavior.
- **D-05:** Configuration and metadata cache are loaded by the caller and passed in; `createMcpAdapter` does not perform its own I/O to load config or cache.
- **D-06:** `index.ts` becomes a thin Pi-specific wrapper: construct `PiAdapter`, convert `ExtensionContext` to `AgentContext` via `adaptPiContext`, then delegate to `createMcpAdapter`.
- **D-07:** Existing exports `mcpAdapter` (default) and `piMcpAdapter` (alias) remain behaviorally identical for Pi users; no breaking changes to Pi consumers.

### the agent's Discretion
- Exact internal file organization and helper placement within `adapters/entry.ts` (e.g., whether to split state management into a separate local module) is left to the planner/executor, provided the public API matches D-02/D-03.
- Specific type-replacement strategies for Pi-coupled types (`AgentToolResult`, `AgentToolUpdateCallback`, `ExtensionContext`, `ExtensionUIContext`, `ToolInfo`, `Model`, `complete`, `AssistantMessage`, pi-tui `Text`) should follow `DECOUPLE-01` through `DECOUPLE-07` and maintain backward compatibility. Where multiple equivalent approaches exist, the agent may choose the one that minimizes source-file edits and upstream-merge conflict surface, consistent with `UPSTREAM-03`/`UPSTREAM-04`.
- Whether to extend `UISystem` with an optional `confirm` method or to map elicitation confirmation onto `notify`/`form` in the Pi adapter is left to the implementation agent, as long as the generic interface does not become Pi-specific.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Milestone v2.0 goals and backward-compatibility principles
- `.planning/REQUIREMENTS.md` — Active requirements: `DECOUPLE-01` through `DECOUPLE-07`, `ENTRY-01` through `ENTRY-03`, `UPSTREAM-03` through `UPSTREAM-04`
- `.planning/ROADMAP.md` — Phase 5 scope, affected files, and requirement mapping
- `.planning/STATE.md` — Current milestone state and prior decisions

### Prior phase context
- `.planning/phases/01-universal-adapter/01-01-CONTEXT.md` — Locked interface design decisions (D-01 through D-17)

### Interfaces and existing adapter
- `interfaces/agent-api.ts` — Generic `AgentAPI`, `AgentContext`, `UISystem`, `ToolInfo`, `ToolRegistration`, `FormConfig`, `FormResult`
- `interfaces/agent-paths.ts` — `AgentPathResolver`, `createPiResolver`, `resolveAgentGlobalConfigPath`
- `adapters/pi-adapter.ts` — `PiAdapter` and `adaptPiContext` reference implementation

### Files to decouple / refactor
- `index.ts` — Current Pi-specific extension entry point; must become thin wrapper
- `proxy-modes.ts` — Uses Pi `AgentToolResult`, `ToolInfo`
- `direct-tools.ts` — Uses Pi `AgentToolResult`, `AgentToolUpdateCallback`, `ExtensionContext`
- `tool-result-renderer.ts` — Uses Pi `AgentToolResult`, `ToolRenderResultOptions`, pi-tui `Text`
- `sampling-handler.ts` — Uses Pi `ExtensionUIContext`, `Model`, `complete`, `AssistantMessage`, `ModelRegistry`
- `elicitation-handler.ts` — Uses Pi `ExtensionUIContext`
- `agent-dir.ts` — Hardcodes `PI_CODING_AGENT_DIR`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PiAdapter` (`adapters/pi-adapter.ts`) already maps all Pi `ExtensionAPI` methods to `AgentAPI`; the new entry point should consume this abstraction.
- `adaptPiContext` converts `ExtensionContext` to `AgentContext`, including optional UI capabilities.
- `interfaces/agent-api.ts` already defines generic `ToolInfo`, `AgentContext`, `UISystem`; some Pi types can be replaced by these directly.

### Established Patterns
- Core MCP logic in `init.ts`, `commands.ts`, `utils.ts`, `state.ts` already migrated to `AgentAPI`/`AgentContext`/`UISystem` in Phases 2–3.
- Backward compatibility is maintained by preserving the existing `mcpAdapter` default export and adding aliases rather than changing signatures.
- Pi-specific type casts are localized at adapter boundaries (`PiAdapter`) rather than spread through core logic.

### Integration Points
- `index.ts` currently registers Pi tools/commands/flags at module load time and wires `session_start` / `session_shutdown` events.
- `createMcpAdapter` in `adapters/entry.ts` will receive an already-constructed `AgentAPI` and `AgentContext`, plus loaded `McpConfig` / `MetadataCache`, and perform the same registration/event wiring in an agent-neutral way.
- The Pi wrapper in `index.ts` will continue to perform Pi-specific early setup (argv config path parsing, loading config/cache) before delegating.

</code_context>

<specifics>
## Specific Ideas

- New file `adapters/entry.ts` should be importable by future non-Pi adapters (e.g., a QoderAdapter in Phase 6) without pulling in `@earendil-works/pi-coding-agent`.
- Keep the Pi adapter package's default export behavior unchanged: `export default function mcpAdapter(pi: ExtensionAPI)` remains the Pi extension activation function.
- When replacing Pi types, prefer widening to `unknown` or introducing local generic aliases over adding Pi-specific optional members to the universal interfaces, per the Phase 1 design philosophy.

</specifics>

<deferred>
## Deferred Ideas

- Phase 6 will implement a non-Pi adapter (e.g., `QoderAdapter`) that consumes `createMcpAdapter`; the exact second agent is not decided here.
- Phase 7 will rebuild `skills/mcp-adapter-test` to verify `createMcpAdapter` across multiple adapters.
- Phase 8 will maintain the upstream-merge manifest and skill; Phase 5 implementation should prefer adapter/wrapper patterns to minimize source edits, per `UPSTREAM-04`.

</deferred>

---

*Phase: 05-type-decoupling-entry-point-refactor*
*Context gathered: 2026-06-15*
