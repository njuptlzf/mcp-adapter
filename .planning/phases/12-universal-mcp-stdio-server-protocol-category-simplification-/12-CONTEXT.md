# Phase 12: Universal MCP Stdio Server — Protocol-Category Simplification - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 eliminates per-agent adapters (KiloAdapter, QoderAdapter, StoreAgentAdapter) and unifies all non-Pi MCP-compatible agents onto a single universal MCP stdio server. Pi retains Branch A exclusively for its native extension features (TUI panel, custom renderers, in-process sampling). The universal server leverages MCP protocol Server→Client reverse calls (sampling/createMessage, elicitation/create) to enable best-effort advanced features for any agent that declares those capabilities.

**In scope:**
- Delete `adapters/kilo-adapter.ts`, `adapters/qoder-adapter.ts`, `adapters/store-adapter.ts`, `adapters/qoder-sampling-provider.ts`, `bin/qoder-mcp-bridge.ts`
- Rename `bin/kilo-mcp-server.ts` → `bin/mcp-server.ts` (universal, agent-agnostic)
- Simplify `AGENT_ADAPTERS` registry: Pi entry + new `universal-mcp` entry
- Remove `createKiloResolver`, `createQoderResolver` from `interfaces/agent-paths.ts`
- Universal config path discovery (no agent-specific paths)
- New `ProtocolSamplingForwarder` (implements `SamplingProvider` via `server.createMessage()`)
- New `ProtocolElicitationForwarder` (implements `UISystem.form` via `server.elicitInput()`)
- `bin/mcp-server.ts` checks Client capabilities at connection time, injects forwarders if supported
- Update SKILL.md: simplify to Branch A (Pi) + Branch C (universal)
- Update README: verified agents list, no per-agent adapter mentions
- Dual-layer tests: unit (in-process, Mock MCP Client) + E2E (subprocess, real MCP Client)
- Update `skills/upstream-merge/references/special-cases.md` with new fork-only file list

**Out of scope:**
- Pi Branch A changes (Pi adapter, pi-sampling-provider, pi-renderer stay unchanged)
- Core logic changes (proxy-modes.ts, server-manager.ts, init.ts — minimal modification only for forwarding support)
- New MCP protocol features beyond sampling/elicitation forwarding (roots, logging — deferred)
- SKILL.md references content beyond branch simplification (resolver.md, generate.md, verify.md content updates are in scope but limited to branch/agent removal)

</domain>

<decisions>
## Implementation Decisions

### Architecture & Registry

- **D-01:** AGENT_ADAPTERS registry keeps Pi entry + adds new `universal-mcp` entry. The `universal-mcp` entry represents the universal MCP stdio server. Kilo and Qoder entries are removed. This preserves `verify:deploy` and parametric test infrastructure while reflecting the single-adapter reality.
- **D-02:** Config path discovery is fully universalized. Remove `~/.kilo/mcp.json` and `~/.qoder/agent/mcp.json` from discovery chain. Keep only: `--config` flag > `MCP_CONFIG_PATH` env > `.mcp.json` in cwd > `~/.config/mcp/mcp.json` (shared global). No agent-specific global paths.
- **D-03:** Pi only uses Branch A (native extension). Branch C (universal MCP stdio) is only for non-Pi MCP-compatible agents. Pi is not offered Branch C as an option in SKILL.md. **Rationale:** This repo forks from `pi-mcp-adapter` and must maintain upstream merge compatibility. Branch A is the upstream's native capability — removing it would break the fork relationship. This is an engineering constraint, NOT a functional limitation of Branch C.
- **D-04:** Delete all per-agent adapter code: `adapters/kilo-adapter.ts`, `adapters/qoder-adapter.ts`, `adapters/store-adapter.ts`, `adapters/qoder-sampling-provider.ts`, `bin/qoder-mcp-bridge.ts`. The `universal-mcp` registry entry's factory provides the AgentAPI implementation for the MCP stdio server context (researcher to determine whether to keep a minimal in-memory adapter or inline it).
- **D-05:** Rename `bin/kilo-mcp-server.ts` → `bin/mcp-server.ts`. The server is agent-agnostic — it does not know or care which agent is connecting. It speaks MCP protocol.

### Protocol Forwarding

- **D-06:** New `ProtocolSamplingForwarder` implements `SamplingProvider` interface. Internally calls `server.createMessage()` (MCP Server→Client `sampling/createMessage` request). The forwarder is injected into `McpServerManager.setSamplingConfig()` when the connecting Agent Client declares `sampling` capability.
- **D-07:** New `ProtocolElicitationForwarder` implements `UISystem.form` interface. Internally calls `server.elicitInput()` (MCP Server→Client `elicitation/create` request). The forwarder is used when the connecting Agent Client declares `elicitation.form` capability. URL elicitation (`elicitation.url`) is also forwarded if supported.
- **D-08:** The universal MCP adapter (Branch C) provides ALL functionality through MCP protocol — it is NOT "best-effort" or "lesser" than Branch A. TUI panel and custom renderers are UI presentation forms, NOT functional capabilities. Branch C provides the same functionality through tool actions (`executeStatus()`) and content blocks. What Pi Branch A provides extra is richer UI (TUI rendering with ANSI codes), which is a presentation enhancement, not a capability difference. `/mcp setup` and `/mcp-auth` can be exposed as tool actions in Branch C (deferred to future implementation, but NOT Pi-only). The term "best-effort" is removed — Branch C is a complete implementation within the MCP protocol's scope.
- **D-11:** Pure forwarding for Sampling — no config check, no local approval. If Agent Client declares `sampling` capability, mcp-adapter unconditionally forwards `sampling/createMessage`. The Agent handles user approval, LLM call, and result. Same logic applies to Elicitation. mcp-adapter does not check `config.settings.sampling` or `config.settings.elicitation` in Branch C.

### Backward Compatibility

- **D-10:** Only register `mcp-server` in package.json bin. No backward compatibility aliases (`kilo-mcp-server` is not kept as an alias). `qoder-mcp-bridge` is deleted entirely. CHANGELOG documents the migration steps. README only contains the latest description (no legacy mentions). Rationale: project has not launched yet, so there are no existing users to break.

### SKILL.md & User Experience

- **D-12:** SKILL.md Phase 0 simplified to a single question: "Pi or other MCP-compatible agent?" If Pi → Branch A (native extension install). If other → Branch C (register `mcp-server` in agent's MCP config). No registry reading, no static capability matrix display. Capabilities are discovered at runtime when the Agent connects as MCP Client. The "Branch" terminology is retained (Branch A / Branch C) for continuity, but Branch B is removed entirely.

### Testing & Documentation

- **D-09:** Integration tests verify universal MCP stdio server compatibility. README documents verified agents list. Per-adapter tests (kilo-adapter, qoder-adapter, store-adapter, qoder-sampling-provider) are deleted. New tests focus on the universal server.
- **D-13:** Dual-layer testing strategy. Unit tests: in-process testing of `createMcpAdapter` + protocol forwarders using Mock MCP Client that declares sampling/elicitation capabilities. E2E tests: subprocess starting `bin/mcp-server.ts`, real MCP Client connecting to verify tool registration, tool calling, and protocol forwarding. `verify:deploy` adapts to the new architecture (`--agent universal-mcp` tests the universal server).

### Agent's Discretion

- The `universal-mcp` registry entry's `factory` function: researcher/planner to determine whether to keep a minimal `StoreAgentAdapter` (renamed, e.g., `InMemoryAdapter`) or inline the AgentAPI implementation into `bin/mcp-server.ts`. The key requirement is that it provides in-memory tool/command/flag storage and event simulation for `createMcpAdapter`.
- The `ProtocolSamplingForwarder` and `ProtocolElicitationForwarder` internal design: researcher to determine exact API shape, error handling, and timeout behavior based on MCP SDK's `Server.createMessage()` and `Server.elicitInput()` methods.
- Test file organization and naming: planner to determine whether to restructure existing test files or create new ones.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP Protocol Specification
- https://modelcontextprotocol.io/specification/2025-06-18/client/sampling — MCP Sampling spec: Server sends `sampling/createMessage` to Client; Client declares `sampling` capability
- https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation — MCP Elicitation spec: Server sends `elicitation/create` to Client; Client declares `elicitation` capability

### MCP SDK (installed)
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js` lines 301-342 — `Server.createMessage()` method: sends `sampling/createMessage` to Client, has capability check
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js` lines 351-384 — `Server.elicitInput()` method: sends `elicitation/create` to Client, has capability check for form/url modes
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js` lines 294-296 — `Server.getCapabilities()`: reads Client's declared capabilities

### Project Architecture
- `.planning/codebase/ARCHITECTURE.md` — System overview, component responsibilities, Agent Host Layer → Interface Layer → Core Logic
- `.planning/codebase/STRUCTURE.md` — Directory layout, file inventory
- `docs/architecture-comparison.md` — Fork vs upstream architecture comparison, three-layer design

### Current Implementation (to be modified)
- `interfaces/agent-api.ts` lines 197-248 — `AGENT_ADAPTERS` registry (to be simplified)
- `interfaces/agent-paths.ts` — `createKiloResolver`, `createQoderResolver` (to be removed)
- `adapters/entry.ts` — `createMcpAdapter()` universal entry point (stays unchanged)
- `bin/kilo-mcp-server.ts` — Current MCP stdio server (to be renamed + enhanced)
- `server-manager.ts` lines 36-49, 157-184 — `setSamplingConfig`, `setElicitationConfig`, `buildClientCapabilities`, `createClient` (forwarding integration points)
- `init.ts` lines 36-54 — Sampling and elicitation enablement conditions (to add forwarding mode)
- `sampling-handler.ts` — Current local sampling handler (reference for ProtocolSamplingForwarder)
- `elicitation-handler.ts` — Current local elicitation handler (reference for ProtocolElicitationForwarder)

### Skills & Documentation (to be updated)
- `skills/mcp-adapter/SKILL.md` — Unified skill (Phase 0 simplification)
- `skills/mcp-adapter/references/resolver.md` — Capability matrix (simplify to Pi + universal)
- `skills/mcp-adapter/references/deploy.md` — Deployment branches (remove Branch B)
- `skills/mcp-adapter/references/verify.md` — Test matrix (update for universal server)
- `skills/upstream-merge/references/special-cases.md` — Fork-only file registry (update entries)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StoreAgentAdapter` (in `adapters/store-adapter.ts`): Generic in-memory AgentAPI implementation with tool/command/flag Maps, event simulators, exec, buffered messages, channel lifecycle. Currently the base class for KiloAdapter and QoderAdapter. Could be retained (renamed) as the AgentAPI implementation for the universal-mcp registry entry.
- `createMcpAdapter()` (in `adapters/entry.ts`): Universal registration hub. Stays unchanged — it already accepts any AgentAPI implementation.
- `McpServerManager.setSamplingConfig()` / `setElicitationConfig()` (in `server-manager.ts`): Existing infrastructure for injecting sampling/elicitation handlers. Protocol forwarders can be injected through the same interface.
- `SamplingProvider` interface (in `interfaces/sampling.ts`): Already abstracted in Phase 5. ProtocolSamplingForwarder just needs to implement this interface.
- `UISystem.form` interface (in `interfaces/agent-api.ts`): Already abstracted. ProtocolElicitationForwarder implements this interface.

### Established Patterns
- **Adapter pattern**: All adapters implement AgentAPI. The universal-mcp entry follows the same pattern — its factory returns an AgentAPI implementation.
- **Capability-gate**: Currently static (registry capabilities). New pattern: dynamic discovery via `server.getCapabilities()` at MCP connection time.
- **Protocol forwarding**: New pattern — mcp-adapter acts as bidirectional MCP proxy. Client→Server direction (tool calls) already works. Server→Client direction (sampling, elicitation) is new.

### Integration Points
- `bin/mcp-server.ts` main() function: After `server.connect(transport)`, check `server.getCapabilities()` for client-declared sampling/elicitation. If present, create forwarders and inject via `manager.setSamplingConfig()` / `manager.setElicitationConfig()`.
- `AGENT_ADAPTERS` registry: `universal-mcp` entry's `factory` provides the AgentAPI for testing. `capabilities` field is static for registry compatibility but actual capabilities are runtime-discovered.
- `package.json` bin: Replace `kilo-mcp-server` and `qoder-mcp-bridge` with single `mcp-server` entry.

</code_context>

<specifics>
## Specific Ideas

- The user's core vision: "任何支持mcp协议的agent都不需要独立实现一种适配器，都是使用一种适配器" — any MCP-compatible agent uses ONE adapter, no per-agent implementation needed.
- Pi-specific features (TUI panel, custom renderers) are Pi's own protocol extensions, not MCP protocol features. The MCP adapter can only implement what MCP protocol supports.
- Protocol forwarding is best-effort: implement Sampling and Elicitation via MCP Server→Client requests. Other features (TUI, renderers, commands) cannot be done via MCP protocol and remain Pi-only.
- The project has not launched yet, so there are no existing users to break — no need for backward compatibility aliases.

</specifics>

<deferred>
## Deferred Ideas

- **Roots forwarding** (`server.listRoots()`): MCP Server can request roots from Client. Could improve the adapter's context awareness (know which directories the agent has access to). Deferred — not in Phase 12 scope.
- **Logging forwarding** (`server.sendLoggingMessage()`): Forward log messages from downstream MCP servers to the agent's log system. Deferred — not in Phase 12 scope.
- **MCP Prompts exposure**: Expose `/mcp setup` wizard as an MCP Prompt or special Tool for Branch C agents. Deferred — requires UX redesign.
- **OAuth management via tools**: Expose `/mcp-auth` functionality as MCP tools for Branch C agents. Deferred — requires UX redesign.
- **Dynamic capability declaration in AGENT_ADAPTERS**: Currently capabilities are static in the registry. Future enhancement: make `universal-mcp` entry's capabilities dynamic based on runtime discovery. Deferred — the static entry is sufficient for Phase 12.

</deferred>

---

*Phase: 12-Universal MCP Stdio Server — Protocol-Category Simplification*
*Context gathered: 2026-06-30*
