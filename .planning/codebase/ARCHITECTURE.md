<!-- refreshed: 2026-06-26 -->
# Architecture

**Analysis Date:** 2026-06-26

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                        Agent Host Layer                                   │
│   Pi (`ExtensionAPI`)  │  Qoder (`qoder-agent-sdk`)  │  Kilo (hook)     │
│   `adapters/pi-adapter.ts` │ `adapters/qoder-adapter.ts` │ `adapters/kilo-adapter.ts` │
└───────────────┬──────────┬──────────────┬──────────────┬─────────────────┘
                │          │              │              │
                ▼          ▼              ▼              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Interface Layer (`interfaces/`)                        │
│   `AgentAPI`  │  `AgentContext`  │  `UISystem`  │  `AgentChannel`       │
│   `SamplingProvider`  │  `AgentPathResolver`  │  `AGENT_ADAPTERS[]`     │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Core Adapter Logic (`adapters/entry.ts`)                │
│   `createMcpAdapter(agentapi, ctx, config, cache)`                       │
│   - Tool registration (proxy + direct)                                   │
│   - Command wiring (`/mcp`, `/mcp-auth`)                                 │
│   - Lifecycle hooks (`session_start`, `session_shutdown`)                │
└───────┬──────────────┬──────────────┬──────────────┬─────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────────────┐
│ Proxy     │ │ Direct    │ │ Config    │ │ UI / Server               │
│ Modes     │ │ Tools     │ │ Layer     │ │ Layer                     │
│ `proxy-   │ │ `direct-  │ │ `config.  │ │ `ui-server.ts`            │
│ modes.ts` │ │ tools.ts` │ │ ts`       │ │ `ui-session.ts`           │
│           │ │           │ │ `agent-   │ │ `mcp-panel.ts`            │
│ execute*  │ │ resolve*, │ │ dir.ts`   │ │ `mcp-setup-panel.ts`      │
│ functions │ │ create*   │ │           │ │ `host-html-template.ts`   │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └────────────┬──────────────┘
      │             │             │                     │
      ▼             ▼             ▼                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Infrastructure Layer                                 │
│  `server-manager.ts`  │  `lifecycle.ts`  │  `init.ts`  │  `state.ts`   │
│  `mcp-auth-flow.ts`   │  `mcp-oauth-provider.ts`  │  `mcp-auth.ts`    │
│  `sampling-handler.ts`│  `elicitation-handler.ts` │  `metadata-cache.ts`│
│  `tool-registrar.ts`  │  `tool-metadata.ts`      │  `resource-tools.ts`│
│  `consent-manager.ts` │  `npx-resolver.ts`       │  `logger.ts`       │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  External: MCP SDK (`@modelcontextprotocol/sdk`)                          │
│  Transports: Stdio, StreamableHTTP, SSE                                  │
│  Auth: OAuth 2.1 (dynamic registration + authorization_code)             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `createMcpAdapter` | Agent-agnostic registration hub: wires tools, commands, flags, lifecycle | `adapters/entry.ts` |
| `PiAdapter` | Bridges Pi's `ExtensionAPI` → `AgentAPI`; adapts `ExtensionContext` → `AgentContext` | `adapters/pi-adapter.ts` |
| `QoderAdapter` | In-memory `AgentAPI` implementation for Qoder SDK; tools/commands/flags stored in Maps | `adapters/qoder-adapter.ts` |
| `KiloAdapter` | In-memory `AgentAPI` for Kilo coding agent; mirrors QoderAdapter pattern | `adapters/kilo-adapter.ts` |
| `McpServerManager` | Client ↔ MCP server connections: connect/disconnect, tool discovery, transport management | `server-manager.ts` |
| `McpLifecycleManager` | Server lifecycle: keep-alive health checks, idle timeout, graceful shutdown | `lifecycle.ts` |
| `initializeMcp` | Bootstrap: load config, connect servers, build metadata, start lifecycle | `init.ts` |
| `loadMcpConfig` | Multi-source config merging (global + project + agent-specific, with import support) | `config.ts` |
| Proxy modes (`execute*`) | MCP proxy tool runtime: call, connect, describe, search, list, status, UI messages | `proxy-modes.ts` |
| Direct tools | Expose MCP tools as native agent tools (registered before session starts) | `direct-tools.ts` |
| `startUiServer` | Embedded HTTP server for interactive MCP tool UIs (SSE-based, session-scoped) | `ui-server.ts` |
| OAuth flow | MCP OAuth 2.1 authentication: authorization_code + client_credentials | `mcp-auth-flow.ts` |
| `McpOAuthProvider` | SDK auth provider wrapping OAuth token lifecycle | `mcp-oauth-provider.ts` |
| MCP panels | TUI overlay panels for server management, auth, setup | `mcp-panel.ts`, `mcp-setup-panel.ts` |
| `AGENT_ADAPTERS` | Static registry of all agent adapters; single source of truth for test harness and deploy verification | `interfaces/agent-api.ts` |

## Pattern Overview

**Overall:** Adapter Pattern with a central registration hub

**Key Characteristics:**
- **Agent-agnostic core** — `createMcpAdapter()` in `adapters/entry.ts` is the universal entry point; it never imports agent-specific types
- **Interface contract** — `AgentAPI` (8 required methods), `AgentContext`, `UISystem`, `AgentChannel`, `SamplingProvider` define the boundary
- **Two adapter strategies**: (1) pass-through (Pi — delegates to a live `ExtensionAPI`), (2) in-memory store (Qoder, Kilo — tools/commands stored in Maps, bridged later by the host)
- **Dual tool exposure**: proxy mode (`mcp({tool, args})` gateway tool) and direct tools (MCP tools registered as native agent tools)
- **Lazy + eager lifecycle**: servers connect lazily on first use, with optional `keep-alive` (health-checked) and `eager` (connect at startup) modes
- **Static adapter registry** (`AGENT_ADAPTERS`) consumed by test harness, capability gate, README matrix — add one descriptor, nothing else changes

## Layers

### Interface Layer
- Purpose: Define the agent-agnostic contract that all adapters must satisfy
- Location: `interfaces/`
- Contains: `AgentAPI`, `AgentContext`, `UISystem`, `AgentChannel`, `SamplingProvider`, `AgentPathResolver`, `AGENT_ADAPTERS` registry
- Depends on: Nothing internal (only `@modelcontextprotocol/sdk` types)
- Used by: All adapters, `createMcpAdapter`, test harness, deploy verification

### Adapter Layer
- Purpose: Implement `AgentAPI` for specific agent hosts
- Location: `adapters/`
- Contains: `entry.ts` (universal hub), `pi-adapter.ts`, `qoder-adapter.ts`, `kilo-adapter.ts`, plus agent-specific sampling providers and renderers
- Depends on: `interfaces/`, agent SDKs (`@earendil-works/pi-coding-agent`, `@qoder-ai/qoder-agent-sdk`)
- Used by: Agent host entry points (`index.ts`, `bin/kilo-mcp-server.ts`, `bin/qoder-mcp-bridge.ts`)

### Core Logic Layer
- Purpose: MCP tool lifecycle, server management, configuration
- Location: Root `.ts` files (`init.ts`, `config.ts`, `proxy-modes.ts`, `direct-tools.ts`, `commands.ts`, `server-manager.ts`, `lifecycle.ts`, `state.ts`)
- Depends on: `interfaces/`, `@modelcontextprotocol/sdk`
- Used by: `createMcpAdapter`

### Auth Layer
- Purpose: OAuth 2.1 authentication flow for MCP servers
- Location: `mcp-auth-flow.ts`, `mcp-oauth-provider.ts`, `mcp-auth.ts`, `oauth-handler.ts`, `mcp-callback-server.ts`
- Depends on: `@modelcontextprotocol/sdk` auth primitives
- Used by: `init.ts`, `proxy-modes.ts`, `direct-tools.ts`

### UI Layer
- Purpose: Interactive server management panels, setup wizards, embedded browser for tool UIs
- Location: `ui-server.ts`, `ui-session.ts`, `mcp-panel.ts`, `mcp-setup-panel.ts`, `host-html-template.ts`, `tool-result-renderer.ts`, `glimpse-ui.ts`
- Depends on: `types.ts`, `server-manager.ts`, `@modelcontextprotocol/ext-apps`
- Used by: `init.ts`, `proxy-modes.ts`, `commands.ts`

### Utility / Shared Layer
- Purpose: Cross-cutting helpers
- Location: `utils.ts`, `logger.ts`, `errors.ts`, `metadata-cache.ts`, `tool-metadata.ts`, `tool-registrar.ts`, `npx-resolver.ts`, `consent-manager.ts`, `sampling-handler.ts`, `elicitation-handler.ts`, `resource-tools.ts`, `onboarding-state.ts`
- Used by: All layers

## Data Flow

### Primary Request Path (Proxy Tool Call)

1. **Agent invokes** `mcp({tool: "xcodebuild_list_sims", args: '{"os":"iOS"}'})` — the "mcp" proxy tool registered in `adapters/entry.ts:296`
2. **Execute handler** (`adapters/entry.ts:314`) parses args, dispatches to `executeCall()` in `proxy-modes.ts:475`
3. **`executeCall` resolves the tool**: searches `state.toolMetadata` across all servers, lazy-connects if needed, handles auth (`proxy-modes.ts:475-835`)
4. **Calls the MCP server**: `connection.client.callTool({name, arguments})` via the SDK client
5. **Transforms result**: `transformMcpContent()` in `tool-registrar.ts` converts MCP content blocks to agent-compatible format
6. **Renders**: `renderMcpToolResult` in `tool-result-renderer.ts` formats the output

### Direct Tool Path

1. **At registration time** (`adapters/entry.ts:115-126`): `resolveDirectTools()` in `direct-tools.ts:76` reads config + metadata cache to build `DirectToolSpec[]`
2. **Each spec** is registered as a native agent tool via `agentapi.registerTool()` with a `createDirectToolExecutor()` closure
3. **When invoked**: the executor lazy-connects to the server, calls the tool directly, transforms and returns the result — no proxy tool indirection

### Session Lifecycle

1. **`session_start` event** → `adapters/entry.ts:135`: shuts down previous state, initializes OAuth, calls `initializeMcp()` (async)
2. **Initialization** (`init.ts:28`): loads config, connects startup servers (eager/keep-alive), builds tool metadata, starts health checks
3. **Runtime**: state available via closure in `createMcpAdapter`; commands (`/mcp`, `/mcp-auth`) and tools access `state` and `initPromise`
4. **`session_shutdown` event** → `adapters/entry.ts:186`: flushes metadata cache, graceful shutdown of lifecycle, OAuth teardown

### UI Session Flow

1. Tool with `uiResourceUri` is called → `maybeStartUiSession()` in `ui-session.ts`
2. `startUiServer()` in `ui-server.ts` starts an embedded HTTP server on localhost
3. Browser opens with a host HTML page embedding the tool's iframe + AppBridge (`app-bridge.bundle.js`)
4. UI sends messages (prompts, intents, notifications) via `/proxy/ui/message` → accumulated in `sessionMessages`
5. Session completes → messages available via `mcp({action: "ui-messages"})`

**State Management:**
- `McpExtensionState` (defined in `state.ts:23`) is the central runtime state object
- Created in `initializeMcp()` and stored in a closure variable `state` within `createMcpAdapter`
- Contains: `McpServerManager` (connections), `McpLifecycleManager` (health), `toolMetadata` (Map<server, ToolMetadata[]>), `config`, `failureTracker`, `uiServer`, `completedUiSessions`
- No global mutable singleton — state is scoped to adapter invocation

## Key Abstractions

### `AgentAPI`
- Purpose: 8-method contract that every agent adapter must implement
- Methods: `registerTool`, `registerCommand`, `registerFlag`, `on`, `getAllTools`, `getFlag`, `sendMessage`, `exec`
- Defined in: `interfaces/agent-api.ts:133`

### `createMcpAdapter(agentapi, ctx, config, cache)`
- Purpose: Single entry point that performs all MCP registration for any agent
- Location: `adapters/entry.ts:58`
- Pattern: Closes over `state` and `initPromise`; uses `agentapi` for all registration; never imports agent-specific types

### `AGENT_ADAPTERS` registry
- Purpose: Static array of `AgentAdapterDescriptor` — the single source of truth for supported agents
- Location: `interfaces/agent-api.ts:193`
- Pattern: Each descriptor provides `id`, `displayName`, `factory` (creates test instance), `resolverFactory` (config path resolution), `envHints`, `capabilities`, optional `createVerificationContext`

### `McpExtensionState`
- Purpose: Central runtime state container for an MCP adapter session
- Location: `state.ts:23`
- Contains: manager, lifecycle, toolMetadata, config, failureTracker, uiServer, completedUiSessions, consentManager, openBrowser, ui, sendMessage

### Transport Abstraction
- Purpose: Unified transport layer across stdio, StreamableHTTP, and SSE
- Location: `server-manager.ts` (private `createConnection`)
- Pattern: Auto-negotiates transport protocol — tries StreamableHTTP first, falls back to SSE; stdio for `command`-based servers; deduplicates concurrent connections

### `AgentChannel`
- Purpose: Bidirectional communication channel between adapter and host session
- Location: `interfaces/agent-channel.ts:19`
- Pattern: `send(message, options)` for adapter→agent; optional `close()`; takes priority over legacy companion methods

## Entry Points

### Pi Extension Entry Point
- Location: `index.ts:18` (default export `mcpAdapter`)
- Triggers: Pi coding agent loads the extension
- Responsibilities: Creates `PiAdapter`, calls `createMcpAdapter`

### Kilo MCP Server
- Location: `bin/kilo-mcp-server.ts`
- Triggers: `kilo-mcp-server` binary (invoked by Kilo agent)
- Responsibilities: Creates `KiloAdapter`, wires up the stdio MCP server bridge

### Qoder MCP Bridge
- Location: `bin/qoder-mcp-bridge.ts`
- Triggers: `qoder-mcp-bridge` binary (invoked by Qoder agent)
- Responsibilities: Creates `QoderAdapter`, attaches to Qoder SDK session

### CLI
- Location: `cli.js`
- Triggers: `pi-mcp-adapter` binary
- Responsibilities: CLI entry for standalone usage

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop; server connections are concurrent via async/await; `parallelLimit` in `init.ts` caps concurrent startup connections at 10
- **Global state:** No mutable global singleton. State is closure-scoped in `createMcpAdapter`. OAuth tokens persist to disk via `mcp-auth.ts` (`~/.pi/agent/mcp-oauth.json`). Metadata cache is at `~/.pi/agent/mcp-tools-cache.json`
- **Circular imports:** `interfaces/agent-api.ts` imports from adapters to populate `AGENT_ADAPTERS` — this is intentional and controlled (only the registry, not runtime code paths)
- **Config layering:** Four config sources merged in priority order: (1) shared global `~/.config/mcp/mcp.json`, (2) Pi global `~/.pi/agent/mcp.json`, (3) shared project `.mcp.json`, (4) Pi project `.pi/mcp.json`. Import system pulls from cursor, claude-code, claude-desktop, codex, windsurf, vscode configs
- **Agent path resolution:** `AgentPathResolver` interface lets each agent define its own config directory. Pi uses `MCP_AGENT_DIR` / `PI_CODING_AGENT_DIR` env vars (default `~/.pi/agent`); Qoder and Kilo use `MCP_AGENT_DIR` only

## Anti-Patterns

### Per-Agent Adapter Requirement

**What happens:** Each new coding agent requires writing a new adapter class (200-350 lines) implementing `AgentAPI`, plus a resolver, plus optional sampling provider and renderer. Adding a new agent means touching ~5 new files.
**Why it's wrong:** The user's architectural vision is that "MCP protocol + hook protocol" should be one agent category — any MCP-compatible agent should reuse one adapter. Currently, Pi has a pass-through adapter, Qoder/Kilo have in-memory store adapters — three different implementations for the same interface.
**Do this instead:** Consolidate QoderAdapter and KiloAdapter into a single `McpAgentAdapter` that works for any agent with a hook/stdio protocol. The agent self-reports its `.mcp.json` location (via hook metadata or env var) instead of per-agent `AgentPathResolver` factories.

### Proxy Tool as Universal Gateway

**What happens:** The "mcp" proxy tool handles 7 modes (tool, connect, describe, search, server, action, status) through a single parameter object with complex disambiguation logic (`executeCall` in `proxy-modes.ts` is 361 lines).
**Why it's wrong:** Tool discovery is awkward — the LLM must know tool names from external sources before calling them through the proxy. Direct tools solve this for pre-registered tools, but lazy-discovered tools still require the proxy intermediary.
**Do this instead:** Expand direct tool registration to cover all tools after first lazy-connect, making the proxy tool optional. The `MCP_DIRECT_TOOLS` env var already supports this pattern for opt-in servers.

### Error Handling
**Strategy:** Two-tier: structured `McpToolResult` returns with `details.error` for expected failures; thrown exceptions for unexpected errors (caught at boundaries)

**Patterns:**
- Tool execution errors return `{content: [{type: "text", text: "Error: ..."}], details: {error: "tool_error"}}` — never throw
- Connection/auth failures return descriptive error messages with recovery instructions (e.g., "Run /mcp-auth serverName first")
- `failureTracker` (Map<serverName, timestamp>) implements 60-second backoff for failed servers
- `McpLifecycleManager.gracefulShutdown()` ensures all connections are closed on session end

## Cross-Cutting Concerns

**Logging:** Structured logging via `logger.ts` (contextual child loggers with component/server/session tags). UI notifications via `UISystem.notify()` for user-visible messages.
**Validation:** Config validation in `config.ts:readValidatedConfig` with graceful degradation (returns empty config on parse failure). Tool name collision detection in direct tool registration (`BUILTIN_NAMES` exclusion set).
**Authentication:** OAuth 2.1 with dynamic client registration. Two grant types: `authorization_code` (interactive) and `client_credentials` (headless). Token persistence to disk. Auto-auth via `settings.autoAuth` flag.

---

*Architecture analysis: 2026-06-26*
