# Phase 12: Universal MCP Stdio Server — Protocol-Category Simplification - Research

**Researched:** 2026-06-30
**Domain:** MCP protocol Server→Client reverse calls (sampling/elicitation forwarding), adapter registry simplification, stdio server unification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Architecture & Registry
- **D-01:** AGENT_ADAPTERS registry keeps Pi entry + adds new `universal-mcp` entry. Kilo and Qoder entries are removed.
- **D-02:** Config path discovery is fully universalized. Remove `~/.kilo/mcp.json` and `~/.qoder/agent/mcp.json` from discovery chain. Keep only: `--config` flag > `MCP_CONFIG_PATH` env > `.mcp.json` in cwd > `~/.config/mcp/mcp.json` (shared global).
- **D-03:** Pi only uses Branch A (native extension). Branch C (universal MCP stdio) is only for non-Pi MCP-compatible agents.
- **D-04:** Delete all per-agent adapter code: `adapters/kilo-adapter.ts`, `adapters/qoder-adapter.ts`, `adapters/store-adapter.ts`, `adapters/qoder-sampling-provider.ts`, `bin/qoder-mcp-bridge.ts`.
- **D-05:** Rename `bin/kilo-mcp-server.ts` → `bin/mcp-server.ts`. The server is agent-agnostic.

#### Protocol Forwarding
- **D-06:** New `ProtocolSamplingForwarder` implements `SamplingProvider` interface. Internally calls `server.createMessage()`. Injected into `McpServerManager.setSamplingConfig()` when the connecting Agent Client declares `sampling` capability.
- **D-07:** New `ProtocolElicitationForwarder` implements `UISystem.form` interface. Internally calls `server.elicitInput()`. Used when Agent Client declares `elicitation.form` capability. URL elicitation (`elicitation.url`) is also forwarded if supported.
- **D-08:** The universal MCP adapter (Branch C) provides ALL functionality through MCP protocol — it is NOT "best-effort". Branch C is a complete implementation within the MCP protocol's scope.
- **D-11:** Pure forwarding for Sampling — no config check, no local approval. If Agent Client declares `sampling` capability, mcp-adapter unconditionally forwards `sampling/createMessage`. Same for Elicitation. mcp-adapter does not check `config.settings.sampling` or `config.settings.elicitation` in Branch C.

#### Backward Compatibility
- **D-10:** Only register `mcp-server` in package.json bin. No backward compatibility aliases. `qoder-mcp-bridge` is deleted entirely. CHANGELOG documents the migration steps. README only contains the latest description.

#### SKILL.md & User Experience
- **D-12:** SKILL.md Phase 0 simplified to a single question: "Pi or other MCP-compatible agent?" If Pi → Branch A. If other → Branch C. No registry reading, no static capability matrix display. Branch B is removed entirely.

#### Testing & Documentation
- **D-09:** Integration tests verify universal MCP stdio server compatibility. Per-adapter tests (kilo-adapter, qoder-adapter, store-adapter, qoder-sampling-provider) are deleted.
- **D-13:** Dual-layer testing strategy. Unit tests: in-process testing with Mock MCP Client. E2E tests: subprocess starting `bin/mcp-server.ts`, real MCP Client connecting.

### Agent's Discretion
- The `universal-mcp` registry entry's `factory` function: researcher/planner to determine whether to keep a minimal `StoreAgentAdapter` (renamed) or inline the AgentAPI implementation into `bin/mcp-server.ts`.
- The `ProtocolSamplingForwarder` and `ProtocolElicitationForwarder` internal design: researcher to determine exact API shape, error handling, and timeout behavior based on MCP SDK's `Server.createMessage()` and `Server.elicitInput()` methods.
- Test file organization and naming: planner to determine whether to restructure existing test files or create new ones.

### Deferred Ideas (OUT OF SCOPE)
- **Roots forwarding** (`server.listRoots()`): Deferred — not in Phase 12 scope.
- **Logging forwarding** (`server.sendLoggingMessage()`): Deferred — not in Phase 12 scope.
- **MCP Prompts exposure**: Expose `/mcp setup` wizard as an MCP Prompt or special Tool. Deferred — requires UX redesign.
- **OAuth management via tools**: Expose `/mcp-auth` functionality as MCP tools. Deferred — requires UX redesign.
- **Dynamic capability declaration in AGENT_ADAPTERS**: Deferred — the static entry is sufficient for Phase 12.
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 12 has no formal REQUIREMENTS.md requirement IDs. The 13 decisions (D-01 through D-13) in CONTEXT.md serve as the de facto requirements. The mapping below links each decision to the research findings that enable implementation.

| Decision | Description | Research Support |
|----------|-------------|------------------|
| D-01 | AGENT_ADAPTERS: Pi + universal-mcp | §Architecture Patterns — Registry Simplification; §Code Examples — universal-mcp descriptor |
| D-02 | Universal config path discovery | §Common Pitfalls — Pitfall 2 (config path); §Code Examples — universal resolver |
| D-03 | Pi Branch A only | §Architecture Patterns — Branch Simplification |
| D-04 | Delete per-agent adapters | §Runtime State Inventory — Files to delete; §Impact Analysis |
| D-05 | Rename kilo-mcp-server → mcp-server | §Code Examples — bin/mcp-server.ts skeleton; §Common Pitfalls — Pitfall 1 (flow reorder) |
| D-06 | ProtocolSamplingForwarder | §Code Examples — ProtocolSamplingForwarder; §Architecture Patterns — Protocol Forwarding |
| D-07 | ProtocolElicitationForwarder | §Code Examples — ProtocolElicitationForwarder; §Common Pitfalls — Pitfall 3 (double conversion) |
| D-08 | Branch C is complete | §State of the Art — capability parity |
| D-09 | Delete per-adapter tests | §Validation Architecture — test files to delete |
| D-10 | Single bin entry | §Runtime State Inventory — package.json |
| D-11 | Pure forwarding, no config check | §Code Examples — init.ts modification; §Common Pitfalls — Pitfall 4 (init.ts conditions) |
| D-12 | SKILL.md simplification | §Architecture Patterns — SKILL.md update |
| D-13 | Dual-layer testing | §Validation Architecture — test strategy |
</phase_requirements>

## Summary

Phase 12 eliminates per-agent adapters (KiloAdapter, QoderAdapter, StoreAgentAdapter) and unifies all non-Pi MCP-compatible agents onto a single universal MCP stdio server (`bin/mcp-server.ts`). The server is agent-agnostic — it speaks MCP protocol and discovers client capabilities at runtime. Protocol forwarding via MCP Server→Client reverse calls (`server.createMessage()` for sampling, `server.elicitInput()` for elicitation) enables advanced features for any agent that declares those capabilities.

The MCP SDK (`@modelcontextprotocol/sdk` v1.29.0, protocol version 2025-11-25) provides the `Server.createMessage()` and `Server.elicitInput()` methods that the forwarders will call. **Critical finding:** the correct method to check client-declared capabilities is `server.getClientCapabilities()`, NOT `server.getCapabilities()` (which returns the server's own capabilities). The CONTEXT.md canonical reference line "Server.getCapabilities(): reads Client's declared capabilities" is **incorrect** — see §Common Pitfalls — Pitfall 5.

The `StoreAgentAdapter` base class already provides everything the `universal-mcp` registry entry needs (in-memory tool/command/flag Maps, event simulators, exec, buffered messages, channel lifecycle). **Recommendation: retain `StoreAgentAdapter` in place** (do NOT delete it despite D-04 listing it) — D-04's intent is to delete the per-agent *subclasses* (KiloAdapter, QoderAdapter) and the Qoder-specific sampling provider. `StoreAgentAdapter` is the generic base that the `universal-mcp` factory will instantiate directly. The planner should clarify this with the user if there's ambiguity, but the code evidence strongly supports retaining it.

**Primary recommendation:** Reorder the `bin/mcp-server.ts` flow so the MCP Server is created and connected BEFORE `fireSessionStart()`, enabling runtime capability discovery and forwarder injection before `initializeMcp()` runs.

## Project Constraints (from AGENTS.md)

- **MUST run `gitnexus_impact` before editing any symbol** — before modifying functions/classes/methods, run impact analysis and report blast radius.
- **MUST run `gitnexus_detect_changes()` before committing** — verify changes only affect expected symbols.
- **MUST warn user** if impact analysis returns HIGH or CRITICAL risk.
- **NEVER edit a function/class/method without first running `gitnexus_impact`** on it.
- **NEVER rename symbols with find-and-replace** — use `gitnexus_rename`.
- **NEVER commit without running `gitnexus_detect_changes()`**.

> **Note:** GitNexus MCP tools may be unavailable in the current runtime. If so, the planner should note this and proceed with manual impact analysis (grep-based caller search) as a fallback.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MCP stdio server (tool exposure) | MCP Server (stdio) | — | The universal server speaks MCP protocol; agent-agnostic |
| Tool call routing (Client→Server) | MCP Server → Adapter → McpServerManager | Downstream MCP Client | Existing flow: agent calls tool → server handles → adapter routes to downstream |
| Sampling forwarding (Server→Client) | MCP Server → Agent Client | ProtocolSamplingForwarder | Server sends `sampling/createMessage` to Client; forwarder bridges to `SamplingProvider` interface |
| Elicitation forwarding (Server→Client) | MCP Server → Agent Client | ProtocolElicitationForwarder | Server sends `elicitation/create` to Client; forwarder bridges to `UISystem.form` interface |
| Client capability discovery | MCP Server (`getClientCapabilities()`) | bin/mcp-server.ts | After `server.connect()`, check what the agent client declared |
| Config path resolution | bin/mcp-server.ts | config.ts | Universal path discovery; no agent-specific paths |
| Adapter registry | interfaces/agent-api.ts | AGENT_ADAPTERS | Static registry with `universal-mcp` + `pi` entries |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.29.0 | MCP protocol implementation (Server, Client, transport, types) | Already installed; provides `Server.createMessage()`, `Server.elicitInput()`, `Server.getClientCapabilities()` `[VERIFIED: node_modules/@modelcontextprotocol/sdk/package.json]` |
| `vitest` | (existing) | Test framework | Already configured in vitest.config.ts; supports in-process and subprocess testing `[VERIFIED: vitest.config.ts]` |
| `typebox` | (existing) | Schema definitions for tool parameters | Used in `adapters/entry.ts` for `Type.Object()` etc. `[VERIFIED: adapters/entry.ts]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `StdioServerTransport` | SDK 1.29.0 | Stdio transport for MCP Server | `bin/mcp-server.ts` — connects server to agent via stdin/stdout `[VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js]` |
| `Client` (MCP SDK) | SDK 1.29.0 | MCP Client for E2E tests | E2E tests: spawn `bin/mcp-server.ts` as subprocess, connect via `StdioClientTransport` `[VERIFIED: server-manager.ts uses Client]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `StoreAgentAdapter` (retained) | Inline AgentAPI into bin/mcp-server.ts | StoreAgentAdapter already provides 285 lines of tested, threat-modeled code; inlining would duplicate it and lose test coverage |
| `getClientCapabilities()` | `getCapabilities()` | `getCapabilities()` returns SERVER capabilities, NOT client's — see Pitfall 5 |

**Installation:**
No new packages needed. All dependencies are already installed.

**Version verification:**
```bash
# Already verified via node_modules inspection
node -e "console.log(require('./node_modules/@modelcontextprotocol/sdk/package.json').version)"
# Output: 1.29.0
```

## Package Legitimacy Audit

No new packages are installed in this phase. All dependencies are existing.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@modelcontextprotocol/sdk` | npm | existing | existing | github.com/modelcontextprotocol/typescript-sdk | OK | Already installed |
| `vitest` | npm | existing | existing | github.com/vitest-dev/vitest | OK | Already installed |
| `typebox` | npm | existing | existing | github.com/sinclairzx/typebox | OK | Already installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │           Agent (MCP Client)                 │
                        │  e.g. Kilo, Claude Desktop, Cursor, etc.     │
                        │  Declares capabilities: sampling, elicitation│
                        └───────────┬───────────────────┬──────────────┘
                                    │ MCP stdio          │ Server→Client
                                    │ Client→Server      │ (createMessage,
                                    │ (tools/list,       │  elicitInput)
                                    │  tools/call)       │
                        ┌───────────▼───────────────────▼──────────────┐
                        │      bin/mcp-server.ts (Universal)           │
                        │  ┌───────────────────────────────────────┐   │
                        │  │  MCP Server (Server class)            │   │
                        │  │  - setRequestHandler(ListTools)       │   │
                        │  │  - setRequestHandler(CallTool)        │   │
                        │  │  - getClientCapabilities() ← after   │   │
                        │  │    server.connect(transport)          │   │
                        │  └───────────┬───────────────────────────┘   │
                        │              │                               │
                        │  ┌───────────▼───────────────────────────┐   │
                        │  │  Capability Check + Forwarder Inject   │   │
                        │  │  if (caps.sampling) → inject           │   │
                        │  │    ProtocolSamplingForwarder           │   │
                        │  │  if (caps.elicitation?.form) → inject  │   │
                        │  │    ProtocolElicitationForwarder        │   │
                        │  └───────────┬───────────────────────────┘   │
                        │              │                               │
                        │  ┌───────────▼───────────────────────────┐   │
                        │  │  StoreAgentAdapter (in-memory)        │   │
                        │  │  + createMcpAdapter() registration     │   │
                        │  │  + fireSessionStart() → initializeMcp  │   │
                        │  └───────────┬───────────────────────────┘   │
                        └──────────────┼───────────────────────────────┘
                                       │
                        ┌──────────────▼───────────────────────────────┐
                        │  McpServerManager (server-manager.ts)         │
                        │  - setSamplingConfig(forwarder)              │
                        │  - setElicitationConfig(forwarder)           │
                        │  - connects to downstream MCP servers        │
                        └──────────────┬───────────────────────────────┘
                                       │ MCP Client→Server
                                       │ (tools/list, tools/call,
                                       │  sampling/createMessage,
                                       │  elicitation/create)
                        ┌──────────────▼───────────────────────────────┐
                        │  Downstream MCP Servers (from .mcp.json)      │
                        │  e.g. calculator, filesystem, github, etc.    │
                        └──────────────────────────────────────────────┘
```

**Data flow trace (primary use case — tool call with sampling):**
1. Agent calls `tools/list` → MCP Server returns registered tools
2. Agent calls `tools/call` (e.g. `mcp` proxy tool) → Server routes to adapter → McpServerManager → downstream server
3. Downstream server sends `sampling/createMessage` → McpServerManager's sampling handler → ProtocolSamplingForwarder.complete() → `server.createMessage()` → Agent handles LLM call → result flows back through the same chain

### Recommended Project Structure
```
adapters/
├── entry.ts                      # createMcpAdapter() — UNCHANGED
├── pi-adapter.ts                 # Pi adapter — UNCHANGED
├── pi-renderer.ts                # Pi renderer — UNCHANGED
├── pi-sampling-provider.ts       # Pi sampling — UNCHANGED
├── store-adapter.ts              # RETAINED — universal-mcp factory uses this directly
├── protocol-sampling-forwarder.ts # NEW — implements SamplingProvider via server.createMessage()
├── protocol-elicitation-forwarder.ts # NEW — implements UISystem.form via server.elicitInput()
│
├── [DELETED] kilo-adapter.ts
├── [DELETED] qoder-adapter.ts
├── [DELETED] qoder-sampling-provider.ts
│
bin/
├── mcp-server.ts                 # RENAMED from kilo-mcp-server.ts + ENHANCED
├── [DELETED] qoder-mcp-bridge.ts
│
interfaces/
├── agent-api.ts                  # MODIFIED — AGENT_ADAPTERS simplified (Pi + universal-mcp)
├── agent-paths.ts                # MODIFIED — remove createKiloResolver, createQoderResolver
├── agent-channel.ts              # UNCHANGED
├── sampling.ts                   # UNCHANGED — SamplingProvider interface
│
scripts/
├── deploy-verify.ts              # AUTO-ADAPTS via AGENT_ADAPTERS
├── [DELETED] kilo-mcp-entry.ts   # Legacy entry, superseded by bin/mcp-server.ts
```

### Pattern 1: Runtime Capability Discovery + Forwarder Injection
**What:** After `server.connect(transport)`, call `server.getClientCapabilities()` to check what the agent client supports. Create forwarders conditionally and inject them into the context BEFORE `fireSessionStart()`.
**When to use:** In `bin/mcp-server.ts` — the universal stdio server entry point.
**Why:** `getClientCapabilities()` is only populated after the MCP initialization handshake completes (inside `server.connect()`). Before that, it returns `undefined`. `[VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js lines 270-287]`

### Pattern 2: Protocol Forwarding (Server→Client Reverse Calls)
**What:** The MCP Server (connected to the Agent) can send requests TO the Client. `server.createMessage()` sends `sampling/createMessage`; `server.elicitInput()` sends `elicitation/create`. The Agent handles these and returns results.
**When to use:** When a downstream MCP server requests sampling/elicitation from mcp-adapter (acting as MCP Client), and mcp-adapter forwards the request to the Agent (via MCP Server→Client).
**Why:** This makes mcp-adapter a bidirectional MCP proxy. Client→Server direction (tool calls) already works. Server→Client direction (sampling, elicitation) is new. `[VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js lines 301-385]`

### Pattern 3: Adapter Registry as Single Source of Truth
**What:** `AGENT_ADAPTERS` in `interfaces/agent-api.ts` is the registry that `deploy-verify.ts`, `adapter-contract.test.ts`, and `capability-gate.test.ts` all consume parametrically.
**When to use:** Adding/removing adapters — just modify the registry array.
**Why:** D-01 locks this pattern. The parametric tests auto-expand across all registered adapters. `[VERIFIED: __tests__/adapter-contract.test.ts line 30-32]`

### Anti-Patterns to Avoid
- **Using `getCapabilities()` instead of `getClientCapabilities()`:** `getCapabilities()` returns the SERVER's own capabilities (tools, resources, prompts) — NOT the client's. The CONTEXT.md canonical reference incorrectly labels this method. See Pitfall 5.
- **Calling `fireSessionStart()` before `server.connect()`:** Client capabilities are only available after `server.connect()` completes the initialization handshake. If `fireSessionStart()` runs first, `initializeMcp()` won't have the forwarders, and downstream sampling/elicitation won't work.
- **Keeping per-agent adapters "just in case":** D-04 is explicit — delete them. The universal server replaces them all.
- **Checking `config.settings.sampling` in Branch C:** D-11 is explicit — pure forwarding, no config check. The Agent Client's capability declaration is the only gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-memory AgentAPI | Custom Map-based adapter | `StoreAgentAdapter` (existing, 285 lines, tested) | Already provides tools/commands/flags Maps, event simulators, exec, buffered messages, channel lifecycle, threat-model coverage |
| MCP protocol Server→Client calls | Custom JSON-RPC | `server.createMessage()` / `server.elicitInput()` | SDK handles capability checking, schema validation, request/response correlation |
| Client capability checking | Manual handshake inspection | `server.getClientCapabilities()` | SDK populates this during initialization; returns the ClientCapabilities object |
| Sampling request/response conversion | Custom converter | Existing `convertSamplingMessage()` in `sampling-handler.ts` | Already handles MCP↔agent-agnostic type conversion |
| Elicitation form schema conversion | Custom converter | Existing `convertMcpSchemaToPiForm()` in `elicitation-handler.ts` | Already handles JSON Schema → FormConfig conversion |

**Key insight:** The existing `sampling-handler.ts` and `elicitation-handler.ts` already contain all the conversion logic between MCP protocol types and the agent-agnostic interfaces. The forwarders reuse this infrastructure — they just change the "backend" from a local provider to a protocol call.

## Runtime State Inventory

> This phase involves file deletions, renames, and registry changes. Runtime state inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no databases or datastores store agent names as keys | None |
| Live service config | None — no external services have agent-specific configuration in UIs or databases | None |
| OS-registered state | None — no OS-level registrations embed agent names (no Task Scheduler, pm2, launchd) | None |
| Secrets/env vars | `MCP_CONFIG_PATH` env var — used by both kilo-mcp-server and qoder-mcp-bridge. The universal mcp-server.ts continues to use this env var — key name unchanged | None (code rename only, env var name stays) |
| Build artifacts | `package.json` bin entries: `kilo-mcp-server` → `mcp-server`, `qoder-mcp-bridge` → DELETED. `scripts/kilo-mcp-entry.ts` → DELETE (legacy script superseded by bin/mcp-server.ts). `vitest.config.ts` coverage thresholds for deleted files → REMOVE | Code edit: update package.json bin, vitest.config.ts thresholds |

**Nothing found in category:** Stored data, Live service config, OS-registered state — verified by codebase search. No runtime systems cache agent names outside the codebase.

### Files to Delete (D-04, D-09)
| File | Reason | Impact |
|------|--------|--------|
| `adapters/kilo-adapter.ts` | D-04: per-agent adapter eliminated | `interfaces/agent-api.ts`, `bin/kilo-mcp-server.ts`, `scripts/kilo-mcp-entry.ts` import it |
| `adapters/qoder-adapter.ts` | D-04: per-agent adapter eliminated | `interfaces/agent-api.ts`, `bin/qoder-mcp-bridge.ts` import it |
| `adapters/qoder-sampling-provider.ts` | D-04: per-agent sampling eliminated | `__tests__/qoder-sampling-provider.test.ts` imports it |
| `bin/qoder-mcp-bridge.ts` | D-04: per-agent bridge eliminated | `package.json` bin entry, `special-cases.md` registry entry |
| `scripts/kilo-mcp-entry.ts` | Legacy entry script, superseded by `bin/mcp-server.ts` | None — not referenced by package.json or tests |
| `__tests__/qoder-adapter.test.ts` | D-09: per-adapter test deleted | None — only tests deleted adapter |
| `__tests__/qoder-adapter-integration.test.ts` | D-09: per-adapter test deleted | None — only tests deleted adapter |
| `__tests__/qoder-sampling-provider.test.ts` | D-09: per-adapter test deleted | None — only tests deleted provider |

### Files to Retain (despite D-04 ambiguity)
| File | Reason | Risk |
|------|--------|------|
| `adapters/store-adapter.ts` | D-04 lists it for deletion, but it's the generic base class that the `universal-mcp` factory needs. KiloAdapter and QoderAdapter are thin wrappers (133 and 158 lines) that extend it. Without StoreAgentAdapter, the universal-mcp factory would need to reimplement 285 lines of tested code. | `[ASSUMED]` — D-04's intent may be to delete only the per-agent subclasses. The planner should confirm with the user. If the user insists on deleting StoreAgentAdapter too, the factory must inline its logic or a new `InMemoryAdapter` must be created from the same code. |
| `__tests__/store-adapter.test.ts` | Tests StoreAgentAdapter directly — still relevant if StoreAgentAdapter is retained | None |

## Common Pitfalls

### Pitfall 1: Flow Ordering in bin/mcp-server.ts
**What goes wrong:** If `fireSessionStart()` is called before `server.connect(transport)`, the `initializeMcp()` function runs without the forwarders, and downstream sampling/elicitation requests will fail because `McpServerManager` has no sampling/elicitation config.
**Why it happens:** The current `bin/kilo-mcp-server.ts` fires `session_start` (line 147) before creating and connecting the MCP Server (lines 164-201). This ordering must be reversed.
**How to avoid:** Reorder the flow:
1. Create adapter, ctx, cache
2. `createMcpAdapter(adapter, ctx, config, cache)` — registers handlers
3. Create MCP Server, set request handlers
4. `await server.connect(transport)` — Agent Client connects, `getClientCapabilities()` now populated
5. Check `server.getClientCapabilities()` for sampling/elicitation
6. If sampling: create `ProtocolSamplingForwarder(server)`, set `ctx.samplingProvider`
7. If elicitation: create `ProtocolElicitationForwarder(server)`, set `ctx.ui.form`, set `ctx.hasUI = true`
8. `adapter.attachChannel(channel)`
9. `await adapter.fireSessionStart(ctx)` — `initializeMcp()` reads ctx with forwarders
**Warning signs:** Downstream MCP server sends `sampling/createMessage` but gets an error "No model available for MCP sampling" — this means `samplingConfig` was not set on the manager.

### Pitfall 2: Config Path Discovery — Agent-Specific Paths
**What goes wrong:** After removing `createKiloResolver` and `createQoderResolver`, any code that calls them will fail at compile time.
**Why it happens:** `bin/kilo-mcp-server.ts` line 116-117 uses `createKiloResolver()`. `bin/qoder-mcp-bridge.ts` line 125 uses `createQoderResolver()`. `interfaces/agent-api.ts` line 20 imports both.
**How to avoid:** Create a universal resolver (or use `DEFAULT_AGENT_RESOLVER` which is `createPiResolver()`, but with a universal global path). D-02 specifies: `--config` > `MCP_CONFIG_PATH` > `.mcp.json` in cwd > `~/.config/mcp/mcp.json`. The `bin/mcp-server.ts` should use `loadMcpConfig(configPath, cwd, genericGlobalPath)` where `genericGlobalPath` is `~/.config/mcp/mcp.json`.
**Warning signs:** `tsc` errors about missing `createKiloResolver` / `createQoderResolver` exports.

### Pitfall 3: Double Conversion for Elicitation
**What goes wrong:** The `elicitation-handler.ts` converts MCP elicitation schema → `FormConfig`, then the `ProtocolElicitationForwarder.form()` converts `FormConfig` → MCP elicitation params, calls `server.elicitInput()`, then converts `ElicitResult` → `FormResult`, then `elicitation-handler.ts` converts `FormResult` → `ElicitResult`. This is a double round-trip conversion.
**Why it happens:** The existing architecture has `elicitation-handler.ts` as the handler for `elicitation/create` from downstream servers, and it uses `ui.form()` as the abstraction. The forwarder implements `ui.form()`, so the conversion goes MCP → FormConfig → MCP → Agent → MCP → FormResult → ElicitResult.
**How to avoid:** Accept the double conversion as a trade-off for architectural consistency. The conversion logic is already tested and correct. The performance impact is negligible (microseconds for object mapping). Alternatively, a future enhancement could bypass `elicitation-handler.ts` for protocol forwarding, but that's out of scope for Phase 12.
**Warning signs:** Elicitation works but with slight latency; forms have correct fields and values.

### Pitfall 4: init.ts Condition Checks
**What goes wrong:** `init.ts` lines 36-48 check `config.settings?.sampling !== false && ctx.samplingProvider && (ctx.hasUI || samplingAutoApprove)` for sampling, and `config.settings?.elicitation !== false && ctx.hasUI && typeof ctx.ui?.form === "function"` for elicitation. If these conditions aren't met, the manager won't have sampling/elicitation configs.
**Why it happens:** D-11 says "no config check" for Branch C, but `init.ts` still checks `config.settings?.sampling`. If the user's config explicitly sets `sampling: false`, the condition fails.
**How to avoid:** Two approaches:
1. **Preferred:** Set `ctx.hasUI = true` and provide `ctx.ui.form` (from the forwarder) and `ctx.samplingProvider` (from the forwarder) BEFORE `fireSessionStart()`. This satisfies all conditions in `init.ts` without modifying it. The `config.settings?.sampling !== false` check passes by default (sampling is not set → `!== false` is true).
2. **Alternative:** Add a `protocolForwarding` flag to `AgentContext` and modify `init.ts` to bypass config checks when set. This requires a core logic change (marked as "minimal modification only" in CONTEXT.md out-of-scope).
**Warning signs:** `manager.samplingConfig` is `undefined` after `initializeMcp()` returns.

### Pitfall 5: `getCapabilities()` vs `getClientCapabilities()` — CRITICAL
**What goes wrong:** Using `server.getCapabilities()` to check if the client supports sampling/elicitation returns the WRONG object — it returns the server's own capabilities (tools, resources, prompts), which will never have `sampling` or `elicitation` fields.
**Why it happens:** The CONTEXT.md canonical reference (line 84) incorrectly states: "lines 294-296 — `Server.getCapabilities()`: reads Client's declared capabilities". This is **factually wrong** based on the SDK source code. The SDK clearly distinguishes:
- `getCapabilities()` (line 294-296): returns `this._capabilities` — the SERVER's capabilities set in the constructor `[VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js]`
- `getClientCapabilities()` (line 285-287): returns `this._clientCapabilities` — the CLIENT's capabilities, populated during `_oninitialize()` (line 272: `this._clientCapabilities = request.params.capabilities`) `[VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js]`
**How to avoid:** ALWAYS use `server.getClientCapabilities()` to check client-declared capabilities. The planner and implementer must be aware that the CONTEXT.md reference is incorrect on this point.
**Warning signs:** `server.getCapabilities().sampling` is always `undefined`; forwarders are never injected; sampling/elicitation silently fail.

### Pitfall 6: Coverage Thresholds for Deleted Files
**What goes wrong:** `vitest.config.ts` has coverage thresholds for `adapters/qoder-adapter.ts` (80%) and `adapters/qoder-sampling-provider.ts` (80%). After deleting these files, the coverage report will either error or report 0% coverage for non-existent files.
**Why it happens:** The vitest config explicitly lists per-file thresholds.
**How to avoid:** Remove the coverage threshold entries for deleted files from `vitest.config.ts`. If `store-adapter.ts` is retained, keep or add its threshold.
**Warning signs:** `vitest run --coverage` fails with threshold errors for files that no longer exist.

## Code Examples

### bin/mcp-server.ts — Core Flow (Reordered)

```typescript
// Source: Synthesized from bin/kilo-mcp-server.ts + MCP SDK source analysis
// [VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js]

import { StoreAgentAdapter } from "../adapters/store-adapter.ts";
import { ProtocolSamplingForwarder } from "../adapters/protocol-sampling-forwarder.ts";
import { ProtocolElicitationForwarder } from "../adapters/protocol-elicitation-forwarder.ts";
import { createMcpAdapter } from "../adapters/entry.ts";
import { loadMcpConfig } from "../config.ts";
import { loadMetadataCache } from "../metadata-cache.ts";
import type { AgentContext } from "../interfaces/agent-api.ts";
import type { AgentChannel } from "../interfaces/agent-channel.ts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join } from "node:path";
import { homedir } from "node:os";

const SERVER_NAME = "mcp-adapter";
const SERVER_VERSION = "2.9.0";
const GENERIC_GLOBAL_CONFIG_PATH = join(homedir(), ".config", "mcp", "mcp.json");

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  // ... (help/version handling same as kilo-mcp-server.ts)

  // 1. Universal config path discovery (D-02)
  const configPath = args.configPath ?? process.env.MCP_CONFIG_PATH;
  const config = loadMcpConfig(configPath, process.cwd(), GENERIC_GLOBAL_CONFIG_PATH);

  // 2. Create adapter (StoreAgentAdapter directly — no per-agent subclass)
  const adapter = new StoreAgentAdapter({
    id: "universal-mcp",
    displayName: "Universal MCP",
    prefix: "[mcp-adapter]",
  });

  // 3. Create initial context (will be enhanced after capability discovery)
  const ctx: AgentContext = {
    cwd: process.cwd(),
    hasUI: false,
  };

  // 4. Register everything (proxy tool, commands, flags, lifecycle)
  const cache = loadMetadataCache();
  createMcpAdapter(adapter, ctx, config, cache);

  // 5. Attach AgentChannel — routes adapter sendMessage to stderr
  const channel: AgentChannel = {
    send: (msg: unknown) => {
      const text = typeof msg === "string" ? msg : JSON.stringify(msg);
      console.error(`[mcp-server] adapter message: ${text}`);
    },
  };
  adapter.attachChannel(channel);

  // 6. Create MCP Server
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  // 7. Set request handlers (same as kilo-mcp-server.ts)
  const mcpTools = [...adapter.tools.entries()].map(([name, tool]) => ({
    name,
    description: tool.description || `MCP proxy tool: ${name}`,
    inputSchema: tool.parameters || { type: "object", properties: {} },
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: callArgs } = request.params;
    const tool = adapter.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    try {
      const result = await tool.execute(
        `call-${Date.now()}`, callArgs || {}, undefined, undefined, ctx,
      );
      const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
    }
  });

  // 8. Connect via stdio transport — CRITICAL: must happen BEFORE fireSessionStart
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 9. Check client capabilities and inject forwarders (D-06, D-07, D-11)
  // CRITICAL: use getClientCapabilities(), NOT getCapabilities()
  // [VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js lines 285-287]
  const clientCaps = server.getClientCapabilities();

  if (clientCaps?.sampling) {
    const samplingForwarder = new ProtocolSamplingForwarder(server);
    ctx.samplingProvider = samplingForwarder;
    // Set hasUI so init.ts sampling condition passes
    ctx.hasUI = true;
  }

  if (clientCaps?.elicitation?.form) {
    const elicitationForwarder = new ProtocolElicitationForwarder(server);
    ctx.ui = {
      notify: (message: string, level: "info" | "warning" | "error") => {
        const method = level === "error" ? "error" : level === "warning" ? "warn" : "info";
        console[method](`[mcp-server] ${message}`);
      },
      form: (config) => elicitationForwarder.form(config),
    };
    ctx.hasUI = true;
  }

  // 10. Fire session_start — triggers initializeMcp which reads ctx with forwarders
  try {
    await adapter.fireSessionStart(ctx);
  } catch (err) {
    console.error(`[mcp-server] Session start error: ${(err as Error).message}`);
  }

  console.error("[mcp-server] MCP server ready via stdio");
}
```

### ProtocolSamplingForwarder

```typescript
// Source: Synthesized from SamplingProvider interface + MCP SDK Server.createMessage() API
// [VERIFIED: interfaces/sampling.ts — SamplingProvider interface]
// [VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js lines 301-343 — createMessage()]

import type { SamplingProvider, SamplingModel, SamplingRequest, SamplingResponse } from "../interfaces/sampling.ts";
import type { ModelPreferences, CreateMessageResult } from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

/**
 * Forwards MCP sampling requests from downstream servers to the Agent Client
 * via the MCP Server→Client `sampling/createMessage` reverse call.
 *
 * D-06: implements SamplingProvider interface.
 * D-11: pure forwarding — no config check, no local approval.
 */
export class ProtocolSamplingForwarder implements SamplingProvider {
  constructor(private readonly server: Server) {}

  /**
   * Returns a placeholder model. In pure forwarding mode (D-11), the Agent
   * Client handles actual model selection. The model returned here is not
   * used for the LLM call — it's only passed to `complete()` which ignores it.
   */
  async resolveModel(_prefs?: ModelPreferences): Promise<SamplingModel | undefined> {
    return { provider: "mcp-protocol", id: "forwarded" };
  }

  /**
   * Forward the sampling request to the Agent Client via server.createMessage().
   * The Agent handles the LLM call, user approval, and result.
   */
  async complete(_model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse> {
    // Convert SamplingRequest to MCP createMessage params
    const messages = request.messages.map(m => ({
      role: m.role,
      content: typeof m.content === "string"
        ? { type: "text" as const, text: m.content }
        : m.content,
    }));

    const result: CreateMessageResult = await this.server.createMessage({
      messages,
      systemPrompt: request.systemPrompt,
      maxTokens: request.maxTokens,
      // Note: modelPreferences is not available in complete() — it was passed
      // to resolveModel(). The Agent Client uses its own model selection.
      // D-11: this is acceptable — pure forwarding, no local model resolution.
    });

    // Convert CreateMessageResult to SamplingResponse
    const text = result.content.type === "text" ? result.content.text : "";
    return {
      text,
      model: result.model,
      stopReason: result.stopReason ?? "endTurn",
    };
  }

  /**
   * D-11: No local approval — the Agent Client handles user approval.
   */
  async confirm(_title: string, _message: string): Promise<boolean> {
    return true;
  }
}
```

### ProtocolElicitationForwarder

```typescript
// Source: Synthesized from UISystem.form interface + MCP SDK Server.elicitInput() API
// [VERIFIED: interfaces/agent-api.ts — UISystem, FormConfig, FormResult]
// [VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js lines 351-385 — elicitInput()]

import type { UISystem, FormConfig, FormResult, FormField } from "../interfaces/agent-api.ts";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { ElicitResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Forwards MCP elicitation requests from downstream servers to the Agent Client
 * via the MCP Server→Client `elicitation/create` reverse call.
 *
 * D-07: implements UISystem.form interface.
 *
 * Note: This causes a double conversion (MCP → FormConfig → MCP → Agent → MCP → FormResult → ElicitResult)
 * because elicitation-handler.ts already converts MCP schema to FormConfig.
 * This is an accepted trade-off for architectural consistency. See Pitfall 3.
 */
export class ProtocolElicitationForwarder {
  constructor(private readonly server: Server) {}

  /**
   * Convert FormConfig to ElicitRequestFormParams and forward to Agent Client.
   */
  async form(config: FormConfig): Promise<FormResult> {
    // Convert FormConfig fields back to JSON Schema for requestedSchema
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const field of config.fields) {
      const schema = convertFieldToSchema(field);
      properties[field.name] = schema;
      if ((field as { required?: boolean }).required) {
        required.push(field.name);
      }
    }

    const result: ElicitResult = await this.server.elicitInput({
      mode: "form",
      message: config.message ?? "",
      requestedSchema: {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
      },
    });

    // Convert ElicitResult to FormResult
    // ElicitResult.action: "accept" | "decline" | "cancel"
    // FormResult.action: "submit" | "secondary" | "cancel"
    if (result.action === "accept") {
      return { action: "submit", values: result.content as Record<string, unknown> };
    }
    if (result.action === "decline") {
      return { action: "secondary" };
    }
    return { action: "cancel" };
  }
}

/**
 * Convert a FormField to a JSON Schema property definition.
 * This is the reverse of elicitation-handler.ts's convertMcpSchemaToPiForm().
 */
function convertFieldToSchema(field: FormField): Record<string, unknown> {
  const type = field.type;
  const base: Record<string, unknown> = {};

  if (type === "select" || type === "multiSelect") {
    // Handle select/multiSelect — convert back to enum or oneOf
    const options = (field as { options?: Array<{ value: string; label?: string }> }).options ?? [];
    if (type === "multiSelect") {
      return {
        type: "array",
        items: { type: "string", enum: options.map(o => o.value) },
        title: field.label,
        description: (field as { description?: string }).description,
      };
    }
    return {
      type: "string",
      enum: options.map(o => o.value),
      title: field.label,
      description: (field as { description?: string }).description,
    };
  }

  if (type === "number" || type === "integer") {
    return {
      type,
      title: field.label,
      description: (field as { description?: string }).description,
      minimum: (field as { minimum?: number }).minimum,
      maximum: (field as { maximum?: number }).maximum,
    };
  }

  if (type === "boolean") {
    return { type: "boolean", title: field.label, description: (field as { description?: string }).description };
  }

  // Default: text
  return {
    type: "string",
    title: field.label,
    description: (field as { description?: string }).description,
    minLength: (field as { minLength?: number }).minLength,
    maxLength: (field as { maxLength?: number }).maxLength,
  };
}
```

### AGENT_ADAPTERS Registry — Simplified (D-01)

```typescript
// Source: Synthesized from current interfaces/agent-api.ts + D-01 decision
// [VERIFIED: interfaces/agent-api.ts lines 197-248 — current registry]

import { StoreAgentAdapter } from "../adapters/store-adapter.ts";
import { PiAdapter } from "../adapters/pi-adapter.ts";
import { createPiResolver } from "./agent-paths.ts";

export const AGENT_ADAPTERS: AgentAdapterDescriptor[] = [
  {
    id: "universal-mcp",
    displayName: "Universal MCP",
    factory: () => new StoreAgentAdapter({
      id: "universal-mcp",
      displayName: "Universal MCP",
      prefix: "[mcp-adapter]",
    }),
    resolverFactory: createUniversalResolver, // new function in agent-paths.ts
    envHints: [{ envVar: "MCP_CONFIG_PATH" }],
    capabilities: { ui: false, sampling: false, renderer: false },
    // Note: actual capabilities are runtime-discovered via getClientCapabilities()
    // The static capabilities field is for registry compatibility only.
    createVerificationContext: (input, adapter) => {
      const ctx: AgentContext = {
        cwd: input.cwd,
        hasUI: input.hasUI,
      };
      return ctx;
    },
  },
  {
    id: "pi",
    displayName: "Pi",
    factory: () => { /* ... existing Pi factory ... */ },
    resolverFactory: createPiResolver,
    envHints: [{ envVar: "PI_CODING_AGENT_DIR" }],
    capabilities: { ui: true, sampling: true, renderer: true },
  },
];
```

### Universal Resolver (D-02)

```typescript
// Source: D-02 decision — universal config path discovery
// [VERIFIED: config.ts line 8 — GENERIC_GLOBAL_CONFIG_PATH already exists]

import { join } from "node:path";
import { homedir } from "node:os";

export function createUniversalResolver(): AgentPathResolver {
  return {
    agentId: "universal-mcp",
    globalConfigPath: () => join(homedir(), ".config", "mcp", "mcp.json"),
    projectConfigName: () => ".mcp.json",
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-agent adapters (KiloAdapter, QoderAdapter) | Single universal MCP stdio server | Phase 12 (this phase) | Eliminates adapter maintenance burden; new MCP-compatible agent = zero code changes |
| Static capability matrix in SKILL.md | Runtime capability discovery via `getClientCapabilities()` | Phase 12 (this phase) | Agents don't need to be in a registry; any MCP-compatible agent works |
| Local sampling (PiSamplingProvider, QoderSamplingProvider) | Protocol forwarding via `server.createMessage()` | Phase 12 (this phase) | Sampling works for any agent that declares `sampling` capability — no SDK-specific implementation needed |
| Local elicitation (Pi's `ui.form()`) | Protocol forwarding via `server.elicitInput()` | Phase 12 (this phase) | Elicitation works for any agent that declares `elicitation.form` capability |
| Branch A/B/C three-way split | Branch A (Pi) + Branch C (universal) | Phase 12 (this phase) | Branch B (SDK bridge) eliminated; simpler user experience |

**Deprecated/outdated:**
- `KiloAdapter` (adapters/kilo-adapter.ts): Replaced by direct `StoreAgentAdapter` usage in `bin/mcp-server.ts`
- `QoderAdapter` (adapters/qoder-adapter.ts): Replaced by direct `StoreAgentAdapter` usage in `bin/mcp-server.ts`
- `QoderSamplingProvider` (adapters/qoder-sampling-provider.ts): Replaced by `ProtocolSamplingForwarder`
- `bin/qoder-mcp-bridge.ts`: Replaced by `bin/mcp-server.ts` (universal stdio, not SDK bridge)
- `scripts/kilo-mcp-entry.ts`: Legacy script, superseded by `bin/mcp-server.ts`
- `createKiloResolver`, `createQoderResolver` (interfaces/agent-paths.ts): Replaced by `createUniversalResolver`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `StoreAgentAdapter` should be retained despite D-04 listing it for deletion | Runtime State Inventory | If user insists on deleting it, the universal-mcp factory must reimplement 285 lines of tested code or create a new `InMemoryAdapter` from the same code |
| A2 | Setting `ctx.hasUI = true` when forwarders are available is safe for all code paths in `init.ts` | Code Examples | Some code paths in `init.ts` use `ctx.hasUI` for UI notifications (status bar, error notifications). With `hasUI = true`, these will call `ctx.ui.notify()` which routes to stderr — functionally correct but may produce unexpected stderr output |
| A3 | The `config.settings?.sampling !== false` check in init.ts passes by default (when sampling is not set in config) | Common Pitfalls — Pitfall 4 | If a user's `.mcp.json` explicitly sets `"sampling": false`, the condition fails and sampling won't be enabled even with a forwarder. D-11 says "no config check" — this may require an init.ts modification to fully satisfy |
| A4 | `modelPreferences` can be safely omitted from `server.createMessage()` in the forwarder | Code Examples — ProtocolSamplingForwarder | The downstream server's model preferences won't be forwarded to the Agent Client. The Agent uses its own model selection. This is acceptable per D-11 (pure forwarding) but may result in a different model than the downstream server requested |
| A5 | The double conversion for elicitation (MCP → FormConfig → MCP) is acceptable | Common Pitfalls — Pitfall 3 | If the conversion loses information (e.g., field types not round-tripping correctly), elicitation forms may have missing or incorrect fields. The existing `convertMcpSchemaToPiForm()` and the new reverse converter must be tested for round-trip fidelity |
| A6 | `scripts/kilo-mcp-entry.ts` is not referenced by package.json or tests and can be safely deleted | Runtime State Inventory | If it IS referenced somewhere (e.g., a CI script or documentation), deletion would break that reference |

## Open Questions (RESOLVED)

1. **StoreAgentAdapter retention** (RESOLVED — user confirmed full deletion)
   - User decision: Delete StoreAgentAdapter entirely (D-04 clarified). The `universal-mcp` registry entry's factory and `bin/mcp-server.ts` each inline their own AgentAPI implementation. No shared adapter base class.
   - Impact: `__tests__/store-adapter.test.ts` must also be deleted (it tests StoreAgentAdapter directly).

2. **URL elicitation forwarding** (RESOLVED — form-only for Phase 12)
   - Decision: Implement form elicitation forwarding only (via `ProtocolElicitationForwarder.form()`). URL elicitation uses the existing `handleUrlElicitation` code path. True URL forwarding deferred. The "if supported" qualifier in D-07 allows this.

3. **init.ts modification depth** (RESOLVED — no init.ts modification needed)
   - Decision: Set `ctx.hasUI = true` and provide forwarders on `ctx.samplingProvider` / `ctx.ui.form`. This satisfies all init.ts conditions without modifying init.ts. Edge case: user explicitly sets `sampling: false` in config — documented as expected behavior (user opt-out).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | (existing) | — |
| `@modelcontextprotocol/sdk` | MCP protocol | ✓ | 1.29.0 | — |
| `tsx` | Running .ts files directly | ✓ | (existing) | — |
| `vitest` | Test framework | ✓ | (existing) | — |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly set in `.planning/config.json` — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npm run test` (includes `test:prebuild` + `vitest run`) |

### Phase Requirements → Test Map
| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-01 | AGENT_ADAPTERS has exactly Pi + universal-mcp | unit | `npx vitest run __tests__/adapter-contract.test.ts -x` | ❌ Wave 0 (update existing) |
| D-04 | Deleted files don't exist | smoke | `npx vitest run` (tsc + test run catches missing imports) | ✅ (existing tsc) |
| D-05 | `bin/mcp-server.ts` exists, `bin/kilo-mcp-server.ts` doesn't | smoke | `ls bin/mcp-server.ts && ! ls bin/kilo-mcp-server.ts` | ❌ Wave 0 |
| D-06 | ProtocolSamplingForwarder implements SamplingProvider | unit | `npx vitest run __tests__/protocol-sampling-forwarder.test.ts -x` | ❌ Wave 0 |
| D-07 | ProtocolElicitationForwarder implements UISystem.form | unit | `npx vitest run __tests__/protocol-elicitation-forwarder.test.ts -x` | ❌ Wave 0 |
| D-08 | Branch C has full tool functionality | integration | `npx vitest run __tests__/adapter-contract.test.ts -x` | ✅ (auto-adapts) |
| D-11 | No config check for sampling/elicitation in Branch C | unit | `npx vitest run __tests__/protocol-sampling-forwarder.test.ts -x` | ❌ Wave 0 |
| D-12 | SKILL.md has simplified Phase 0 | manual | Manual review | N/A |
| D-13 | E2E test spawns bin/mcp-server.ts as subprocess | e2e | `npx vitest run __tests__/mcp-server-e2e.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (quick — existing tests + new unit tests)
- **Per wave merge:** `npm run test` (full suite including prebuild)
- **Phase gate:** Full suite green + `npm run verify:deploy -- --agent universal-mcp` + `npm run upstream:check` + `npx tsc --noEmit`

### Wave 0 Gaps
- [ ] `__tests__/protocol-sampling-forwarder.test.ts` — covers D-06, D-11 (Mock MCP Client declaring sampling capability)
- [ ] `__tests__/protocol-elicitation-forwarder.test.ts` — covers D-07 (Mock MCP Client declaring elicitation.form capability)
- [ ] `__tests__/mcp-server-e2e.test.ts` — covers D-13 (subprocess + real MCP Client)
- [ ] `__tests__/fixtures/mock-mcp-client.ts` — shared fixture: Mock MCP Client that declares sampling/elicitation capabilities and records createMessage/elicitInput calls
- [ ] Update `__tests__/adapter-contract.test.ts` — verify it auto-adapts to new AGENT_ADAPTERS (should need zero edits, but verify)
- [ ] Update `__tests__/capability-gate.test.ts` — verify it auto-adapts (should need zero edits)
- [ ] Framework install: None needed (vitest already configured)

### Test Files to Delete (D-09)
| File | Reason |
|------|--------|
| `__tests__/qoder-adapter.test.ts` | Tests deleted QoderAdapter |
| `__tests__/qoder-adapter-integration.test.ts` | Tests deleted QoderAdapter |
| `__tests__/qoder-sampling-provider.test.ts` | Tests deleted QoderSamplingProvider |

### Test Files to Keep
| File | Reason |
|------|--------|
| `__tests__/store-adapter.test.ts` | Tests StoreAgentAdapter directly — still relevant if retained |
| `__tests__/adapter-contract.test.ts` | Parametric via AGENT_ADAPTERS — auto-adapts |
| `__tests__/capability-gate.test.ts` | Parametric via AGENT_ADAPTERS — auto-adapts |
| `__tests__/sampling-handler.test.ts` | Tests sampling-handler.ts which is UNCHANGED |
| `__tests__/elicitation-handler.test.ts` | Tests elicitation-handler.ts which is UNCHANGED |
| `__tests__/server-manager-sampling.test.ts` | Tests server-manager sampling config — UNCHANGED |

### vitest.config.ts Updates Required
- Remove coverage thresholds for: `adapters/qoder-adapter.ts`, `adapters/qoder-sampling-provider.ts`, `adapters/qoder-renderer.ts`, `scripts/qoder-smoke.ts`
- Add coverage thresholds for: `adapters/protocol-sampling-forwarder.ts`, `adapters/protocol-elicitation-forwarder.ts` (if desired)

### verify:deploy Adaptation (D-13)
The `scripts/deploy-verify.ts` reads `AGENT_ADAPTERS` parametrically. After updating the registry:
- `--agent universal-mcp` will test the universal-mcp entry
- `--agent pi` will skip (no `createVerificationContext`)
- `--agent kilo` and `--agent qoder` will fail ("No adapter found") — this is expected and correct

## Security Domain

> `security_enforcement` is not explicitly set in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No authentication in this phase (MCP stdio is local) |
| V3 Session Management | no | No session management changes |
| V4 Access Control | no | No access control changes |
| V5 Input Validation | yes | MCP SDK validates `createMessage` and `elicitInput` params via Zod schemas. The forwarders pass through SDK-validated types. `[VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js — safeParse in setRequestHandler]` |
| V6 Cryptography | no | No crypto operations |
| V7 Error Handling | yes | Forwarders must catch `server.createMessage()` / `server.elicitInput()` errors and convert to meaningful SamplingResponse/ElicitResult. The SDK's `assertCapabilityForMethod` throws if capability is missing. `[VERIFIED: server/index.js lines 151-172]` |
| V8 Data Protection | yes | T-10-01 pattern from StoreAgentAdapter: error logging uses prefix + event name only, never args. Forwarders should follow the same pattern. `[VERIFIED: adapters/store-adapter.ts lines 261-276]` |

### Known Threat Patterns for MCP stdio server

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Information disclosure via stderr | Information Disclosure | `bin/mcp-server.ts` routes adapter messages to stderr (not stdout). MCP protocol uses stdout. This separation is already in place. `[VERIFIED: bin/kilo-mcp-server.ts lines 137-142]` |
| Injection via tool arguments | Tampering | `CallToolRequestSchema` handler validates tool name and args. The adapter's `tool.execute()` handles argument validation. `[VERIFIED: bin/kilo-mcp-server.ts lines 174-197]` |
| Sampling request payload leakage | Information Disclosure | `ProtocolSamplingForwarder.complete()` must NOT log `request.messages` or `request.systemPrompt`. Follow T-06-03 pattern from `QoderSamplingProvider`. `[CITED: adapters/qoder-sampling-provider.ts lines 196-203]` |
| Elicitation response data leakage | Information Disclosure | `ProtocolElicitationForwarder.form()` must NOT log `result.content` (may contain user PII). Log only `result.action`. `[ASSUMED]` |
| Capability spoofing | Spoofing | The Agent Client declares capabilities during MCP initialization. The SDK populates `getClientCapabilities()` from the initialize request. No way for the server to verify the client actually implements the capability — it's trust-based. `[VERIFIED: server/index.js line 272]` |

## Sources

### Primary (HIGH confidence)
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js` — `Server.createMessage()` (lines 301-343), `Server.elicitInput()` (lines 351-385), `Server.getClientCapabilities()` (lines 285-287), `Server.getCapabilities()` (lines 294-296), `Server._oninitialize()` (lines 270-281), `Server.assertCapabilityForMethod()` (lines 151-172)
- `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts` — `ClientCapabilitiesSchema` (line 572-615), `CreateMessageResultSchema` (line 4317), `ElicitResultSchema` (line 5381), `ElicitRequestFormParamsSchema` (line 4966), `ElicitRequestURLParamsSchema` (line 5067)
- `node_modules/@modelcontextprotocol/sdk/package.json` — version 1.29.0, protocol version 2025-11-25
- `interfaces/agent-api.ts` — `AGENT_ADAPTERS` registry (lines 197-248), `AgentAPI` interface, `AgentAdapterDescriptor`, `UISystem`, `AgentContext`
- `interfaces/agent-paths.ts` — `createKiloResolver`, `createQoderResolver`, `createPiResolver`, `DEFAULT_AGENT_RESOLVER`
- `interfaces/sampling.ts` — `SamplingProvider` interface, `SamplingRequest`, `SamplingResponse`, `SamplingModel`
- `adapters/store-adapter.ts` — `StoreAgentAdapter` class (285 lines), `AgentProfile`, `AgentChannel`
- `adapters/entry.ts` — `createMcpAdapter()` function (382 lines)
- `adapters/kilo-adapter.ts` — `KiloAdapter` (133 lines, to be deleted)
- `adapters/qoder-adapter.ts` — `QoderAdapter` (158 lines, to be deleted)
- `adapters/qoder-sampling-provider.ts` — `QoderSamplingProvider` (322 lines, to be deleted)
- `bin/kilo-mcp-server.ts` — Current stdio server (209 lines, to be renamed + enhanced)
- `bin/qoder-mcp-bridge.ts` — Current SDK bridge (190 lines, to be deleted)
- `server-manager.ts` — `McpServerManager` class, `setSamplingConfig()`, `setElicitationConfig()`, `buildClientCapabilities()`, `createClient()`
- `init.ts` — `initializeMcp()` function, sampling/elicitation enablement conditions (lines 36-54)
- `sampling-handler.ts` — `registerSamplingHandler()`, `handleSamplingRequest()`, `ServerSamplingConfig`
- `elicitation-handler.ts` — `registerElicitationHandler()`, `handleElicitationRequest()`, `ServerElicitationConfig`, `convertMcpSchemaToPiForm()`
- `scripts/deploy-verify.ts` — Universal deployment verification (218 lines)
- `skills/upstream-merge/references/special-cases.md` — Fork-only file registry (52 lines, 37 entries)
- `vitest.config.ts` — Test configuration with coverage thresholds
- `package.json` — bin entries, scripts
- `.planning/config.json` — `workflow.nyquist_validation` not set (treat as enabled)
- `AGENTS.md` — GitNexus project constraints

### Secondary (MEDIUM confidence)
- MCP Protocol Specification (2025-06-18) — Sampling and Elicitation specs referenced in CONTEXT.md canonical_refs but not directly fetched in this session. The SDK implementation matches the spec.

### Tertiary (LOW confidence)
- None — all findings verified from codebase or SDK source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, versions verified
- Architecture: HIGH — all integration points verified from source code
- Protocol forwarding: HIGH — `createMessage()` and `elicitInput()` APIs verified from SDK source; forwarder designs follow directly from interface definitions
- Pitfalls: HIGH — critical `getClientCapabilities()` vs `getCapabilities()` distinction verified from SDK source; flow ordering verified from current `bin/kilo-mcp-server.ts` code
- StoreAgentAdapter retention: MEDIUM — code evidence supports retention, but D-04 wording is ambiguous (see Assumptions Log A1)
- init.ts interaction: MEDIUM — approach verified from code, but edge case with explicit `sampling: false` config needs user confirmation (see Assumptions Log A3)

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (30 days — stable codebase, no external API dependencies)
