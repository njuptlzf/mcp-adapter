# External Integrations

**Analysis Date:** 2026-06-26

## APIs & External Services

### Agent APIs (Adapter Targets)

**Pi Coding Agent:**
- What it's used for: First-class agent integration — tool registration, command handling, event lifecycle, UI notifications, model sampling
- SDK/Client: `@earendil-works/pi-coding-agent` (peer + optional dependency, ^0.74.0)
- Auth: Handled by Pi's `ExtensionAPI` — no separate auth
- Adapter: `adapters/pi-adapter.ts` — `PiAdapter` class wraps `ExtensionAPI` as a pass-through, bridging Pi-specific types (`ExtensionContext`, `ExtensionUIContext`) to universal `AgentContext`/`UISystem`
- Context converter: `adaptPiContext()` in `adapters/pi-adapter.ts`
- Sampling: `adapters/pi-sampling-provider.ts` — bridges Pi's `ModelRegistry` to MCP sampling protocol
- Renderer: `adapters/pi-renderer.ts` — wraps tool call/result renderers for Pi's Text component

**Qoder Coding Agent:**
- What it's used for: SDK-bridge integration — MCP tool bridging into Qoder sessions via `createSdkMcpServer()` and `query()`
- SDK/Client: `@qoder-ai/qoder-agent-sdk` ^1.0.7
- Auth: No separate auth; Qoder session handles its own
- Adapter: `adapters/qoder-adapter.ts` — `QoderAdapter` class with in-memory store (Qoder has no synchronous registration API)
- Entry point: `bin/qoder-mcp-bridge.ts` — invoked as a Qoder SessionStart hook
- Context converter: `adaptQoderContext()` in `adapters/qoder-adapter.ts`
- Sampling: `adapters/qoder-sampling-provider.ts` — bridges Qoder sampling to MCP protocol
- Communication: `AgentChannel` interface (`interfaces/agent-channel.ts`) wraps `Query.streamInput()` for bidirectional messaging

**Kilo Coding Agent:**
- What it's used for: MCP stdio server bridge — exposes registered tools as an MCP server that Kilo's native MCP client auto-discovers
- SDK/Client: None — pure MCP stdio transport
- Adapter: `adapters/kilo-adapter.ts` — `KiloAdapter` class with in-memory store (mirrors Qoder pattern)
- Entry point: `bin/kilo-mcp-server.ts` — stdio MCP server
- Context converter: `adaptKiloContext()` in `adapters/kilo-adapter.ts`

### MCP Protocol SDK

**@modelcontextprotocol/sdk:**
- What it's used for: Full MCP protocol implementation — client connections, tool discovery, tool execution, resource reading, OAuth authentication, transports
- Version: ^1.25.1
- Key imports used across the codebase:
  - `Client` from `@modelcontextprotocol/sdk/client/index.js` — MCP client (`server-manager.ts`)
  - `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js` — stdio transport (`server-manager.ts`)
  - `SSEClientTransport` from `@modelcontextprotocol/sdk/client/sse.js` — SSE fallback transport (`server-manager.ts`)
  - `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk/client/streamableHttp.js` — primary HTTP transport (`server-manager.ts`, `mcp-auth-flow.ts`)
  - `auth`, `UnauthorizedError` from `@modelcontextprotocol/sdk/client/auth.js` — OAuth flow (`mcp-auth-flow.ts`, `mcp-oauth-provider.ts`)
  - `OAuthClientProvider` interface from `@modelcontextprotocol/sdk/client/auth.js` — implemented by `McpOAuthProvider`
  - `Server`, `StdioServerTransport` from `@modelcontextprotocol/sdk/server/...` — MCP server for Kilo (`bin/kilo-mcp-server.ts`)
  - Various types from `@modelcontextprotocol/sdk/types.js` and `@modelcontextprotocol/sdk/shared/auth.js`

**@modelcontextprotocol/ext-apps:**
- What it's used for: AppBridge bundling for MCP UI integration (browser↔server communication)
- Version: ^1.2.2
- Output: `app-bridge.bundle.js` (289KB) — bundled MCP SDK + Zod for in-browser use

## MCP Server Connections

### Transport Types

The adapter connects to external MCP servers via three transport mechanisms, all managed by `McpServerManager` (`server-manager.ts`):

**1. stdio Transport:**
- Used for: Local MCP servers started as child processes
- Config: `ServerEntry.command` + `ServerEntry.args`
- Implementation: `StdioClientTransport` from MCP SDK
- Special handling: `npx`/`npm` commands are resolved to direct binary paths via `npx-resolver.ts` to skip the ~143MB npm parent process
- Environment: Process env inherited + `ServerEntry.env` overrides with `${VAR}` interpolation
- Debug: `ServerEntry.debug: true` pipes stderr to parent

**2. StreamableHTTP Transport (primary HTTP):**
- Used for: Remote MCP servers over HTTP
- Config: `ServerEntry.url`
- Implementation: `StreamableHTTPClientTransport` from MCP SDK
- Auth: OAuth provider injected via `authProvider` option
- Fallback: Probes with a test client first; falls back to SSE on failure

**3. SSE Transport (legacy HTTP fallback):**
- Used for: Older MCP servers that don't support StreamableHTTP
- Triggered: When StreamableHTTP probe fails (non-UnauthorizedError)
- Implementation: `SSEClientTransport` from MCP SDK

### Connection Lifecycle

- **Lazy (default):** Servers connect on first tool call, not at startup. Metadata is cached to disk so `search`/`list`/`describe` work offline.
- **Eager:** Connect at startup, no auto-reconnect on drop. No idle timeout by default.
- **Keep-alive:** Connect at startup, auto-reconnect via 30s health checks, no idle timeout.
- **Idle timeout:** Default 10 minutes global (`McpSettings.idleTimeout`), overridable per-server (`ServerEntry.idleTimeout`)
- Management: `McpLifecycleManager` (`lifecycle.ts`) handles health checks, reconnects, and idle shutdown

## Data Storage

**MCP Config Files:**
- Shared global: `~/.config/mcp/mcp.json`
- Shared project: `.mcp.json`
- Pi global override: `~/.pi/agent/mcp.json` (or `$PI_CODING_AGENT_DIR/mcp.json`)
- Pi project override: `.pi/mcp.json`
- Qoder global: `~/.qoder/agent/mcp.json` (or `$MCP_AGENT_DIR/mcp.json`)
- Kilo global: `~/.kilo/mcp.json` (or `$MCP_AGENT_DIR/mcp.json`)
- Config loading: `config.ts` — merges from multiple sources with precedence, expands `imports`

**Metadata Cache:**
- Location: `<agent-dir>/mcp-cache.json` (e.g., `~/.pi/agent/mcp-cache.json`)
- Purpose: Caches tool metadata (names, descriptions, schemas) so search/list/describe work without live server connections
- Implementation: `metadata-cache.ts` — versioned JSON cache with config-hash validation

**OAuth Token Storage:**
- Location: `<agent-dir>/mcp-oauth/sha256-<server-hash>/tokens.json`
- Permissions: `0o600` for token files, `0o700` for directories
- Storage: Access tokens, refresh tokens, client info, code verifier, OAuth state
- Implementation: `mcp-auth.ts` — hashed per-server storage with URL validation

**File Storage:**
- Local filesystem only — no cloud storage services

**Caching:**
- In-memory: `Map<string, ServerConnection>` in `McpServerManager`, `Map<string, ToolMetadata[]>` in `McpExtensionState`
- Disk: `mcp-cache.json` for tool metadata persistence across sessions

## Authentication & Identity

### OAuth 2.1 + PKCE Authentication

**Auth Flow (`mcp-auth-flow.ts`):**
- Automatic OAuth endpoint discovery (RFC 9728 — `/.well-known/oauth-protected-resource`)
- Dynamic client registration (RFC 7591) when no `clientId` is configured
- PKCE with S256 method — mandatory for all flows
- CSRF protection via cryptographically secure state parameter
- Browser-based authorization with automatic callback handling

**OAuth Provider (`mcp-oauth-provider.ts`):**
- Implements MCP SDK's `OAuthClientProvider` interface
- Grant types: `authorization_code` (browser flow, default) and `client_credentials` (non-interactive)
- Client metadata: `client_name` (default: "Pi Coding Agent"), `client_uri`, redirect URIs
- Token lifecycle: storage, retrieval, refresh, invalidation

**Callback Server (`mcp-callback-server.ts`):**
- Node.js HTTP server on loopback (`localhost`)
- Dynamic port: OS-assigned for dynamic registration; configurable via `MCP_OAUTH_CALLBACK_PORT` (default: 19876) for pre-registered clients
- Handles: `code`, `state`, `error` parameters; displays success/error HTML
- 5-minute timeout for pending authorizations

**Auth Commands:**
- `/mcp-auth <server>` — Initiate OAuth flow (`commands.ts` → `mcp-auth-flow.ts`)
- `/mcp logout <server>` — Clear stored credentials
- `settings.autoAuth: true` — Auto-run OAuth on connect/tool calls and retry once

### Bearer Token Auth
- Static Bearer token via `ServerEntry.bearerToken` or `ServerEntry.bearerTokenEnv`
- Added as `Authorization: Bearer <token>` header on HTTP transports

## Config Import (Cross-Agent Compatibility)

The adapter can import MCP server configurations from other coding agents' config files. Handled by `config.ts`:

| Import Kind | Source Path(s) |
|-------------|---------------|
| `cursor` | `~/.cursor/mcp.json` |
| `claude-code` | `~/.claude/mcp.json`, `~/.claude.json`, `~/.claude/claude_desktop_config.json` |
| `claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| `codex` | `~/.codex/config.json` |
| `windsurf` | `~/.windsurf/mcp.json` |
| `vscode` | `.vscode/mcp.json` (project-relative) |

Config merge precedence: shared global → agent global → shared project → agent project. `imports` are expanded first (lower priority), then agent-owned servers override.

## MCP Protocol Features

### MCP Sampling (`sampling-handler.ts`)
- Allows MCP servers to request LLM sampling through the host agent's models
- Pi: Bridges to `ModelRegistry` via `PiSamplingProvider` (`adapters/pi-sampling-provider.ts`)
- Qoder: Bridges via `QoderSamplingProvider` (`adapters/qoder-sampling-provider.ts`)
- Config: `settings.sampling` (default: true when UI is available), `settings.samplingAutoApprove`
- Text-only; context inclusion, tools, stop sequences, audio, and images are rejected

### MCP Elicitation (`elicitation-handler.ts`)
- Allows MCP servers to request user input through agent UI forms/URL prompts
- Form elicitation: Rendered through host agent's `ui.form()` → mapped to MCP actions (submit→accept, secondary→decline, cancel→cancel)
- URL elicitation: Opens browser unless `elicitationAutoOpenUrls` is enabled
- Config: `settings.elicitation` (default: true when UI form is available), `settings.elicitationAutoOpenUrls`

### MCP UI Integration (`ui-server.ts`, `ui-session.ts`, `ui-resource-handler.ts`)
- MCP servers can ship interactive UIs (MCP UI standard)
- Tool metadata includes `_meta.ui.resourceUri` — adapter fetches HTML and opens in iframe
- Bidirectional communication via `AppBridge` (`app-bridge.bundle.js`)
- Native rendering on macOS via Glimpse (`glimpse-ui.ts`); browser fallback
- Session reuse: Calling the same tool while UI is open pushes updates instead of replacing
- Message types: `prompt`, `intent`, `notify`, `message` — retrievable via `mcp({ action: "ui-messages" })`
- Tool consent: `ConsentManager` (`consent-manager.ts`) gates whether UIs can call MCP tools

## Monitoring & Observability

**Logging:**
- Centralized logger: `logger.ts` — structured logging with levels (debug/info/warn/error) and context
- Debug mode: `MCP_UI_DEBUG=1` env var
- Prefixes: `[MCP-UI]`, `[MCP-UI:DEBUG]`, `[MCP-UI:WARN]`, `[MCP-UI:ERROR]`
- Adapter-specific prefixes: `[mcp-adapter/qoder]`, `[mcp-adapter/kilo]`, `[kilo-mcp-server]`, `[qoder-mcp-bridge]`
- Custom log handlers: `logger.addHandler()` for integration with host agent logging

**Error Tracking:**
- No external error tracking service
- Errors propagated via `McpToolResult` with `details.error` field
- Connection failures tracked with backoff via `failureTracker` Map in `McpExtensionState`
- OAuth errors surfaced through `UnauthorizedError` from MCP SDK

## CI/CD & Deployment

**Hosting:**
- npm registry: package `pi-mcp-adapter`

**CI Pipeline:**
- Test commands: `npm test` (vitest run), `npm run test:coverage` (with coverage)
- Deployment verification: `npm run verify:deploy` → `scripts/deploy-verify.ts`
- Upstream divergence check: `npm run upstream:check` → `scripts/upstream-divergence.ts`

## Environment Configuration

**Required env vars (for operation):**
None are strictly required; all have defaults. Key optional vars:

| Variable | Purpose | Default |
|----------|---------|---------|
| `MCP_CONFIG_PATH` | Explicit MCP config path | auto-discovered |
| `MCP_AGENT_DIR` | Agent global config directory (Kilo/Qoder) | `~/.kilo/` or `~/.qoder/agent/` |
| `PI_CODING_AGENT_DIR` | Pi agent directory | `~/.pi/agent/` |
| `MCP_DIRECT_TOOLS` | Direct tool override | (not set) |
| `MCP_OAUTH_CALLBACK_PORT` | OAuth callback port | 19876 |
| `BROWSER` | Custom browser command | system default |

**Secrets location:**
- OAuth tokens: `<agent-dir>/mcp-oauth/sha256-<hash>/tokens.json` (per-server, `0o600`)
- Bearer tokens: In MCP config files or env vars referenced by `bearerTokenEnv`
- `.env` file: Not detected in project root

## Webhooks & Callbacks

**Incoming:**
- OAuth callback server: `http://localhost:<port>/callback` — receives authorization codes from OAuth providers (`mcp-callback-server.ts`)
- MCP server notifications: `serverStreamResultPatchNotification` — streaming UI result patches (`server-manager.ts`)

**Outgoing:**
- OAuth authorization requests: Redirects user's browser to provider's authorization URL (`mcp-auth-flow.ts`)
- MCP tool calls: Outbound `client.callTool()`, `client.readResource()` to connected MCP servers
- Agent messages: `agentapi.sendMessage()` or `AgentChannel.send()` for UI↔agent communication

## Data Flow Summary

### Primary Request Path: MCP Proxy Tool Call

```
User/LLM calls mcp({ tool: "server_tool", args: '{"key":"val"}' })
        │
        ▼
adapters/entry.ts: execute() — parse args, resolve state
        │
        ▼
proxy-modes.ts: executeCall() — find tool metadata, lazy-connect server
        │
        ▼
server-manager.ts: McpServerManager.connect() — stdio/HTTP transport
        │
        ▼
@modelcontextprotocol/sdk Client.callTool()
        │
        ▼
External MCP Server (stdio process or HTTP endpoint)
        │
        ▼
tool-result-renderer.ts: transformMcpContent() — render result
        │
        ▼
Agent displays result to user
```

### OAuth Authentication Flow

```
User: /mcp-auth <server>
        │
        ▼
commands.ts → mcp-auth-flow.ts: authenticate()
        │
        ▼
mcp-auth-flow.ts: startAuth() → McpOAuthProvider + SDK auth()
        │
        ├─► OAuth Provider: discover endpoints, register client
        │
        ▼
mcp-auth-flow.ts: open() → Browser redirect to provider
        │
        ▼
mcp-callback-server.ts: receive code on localhost callback
        │
        ▼
mcp-auth-flow.ts: completeAuth() — exchange code for tokens
        │
        ▼
mcp-oauth-provider.ts: saveTokens() → mcp-auth.ts disk storage
```

### Agent Adapter Registration Flow

```
Agent startup
        │
        ▼
index.ts: mcpAdapter(pi)  OR  bin/kilo-mcp-server.ts  OR  bin/qoder-mcp-bridge.ts
        │
        ▼
adapters/entry.ts: createMcpAdapter(agentapi, ctx, config, cache)
        │
        ├─► Register proxy "mcp" tool (or direct tools)
        ├─► Register /mcp, /mcp-auth commands
        ├─► Register --mcp-config flag
        ├─► Register session_start handler → initializeMcp()
        └─► Register session_shutdown handler → gracefulShutdown()
        │
        ▼
init.ts: initializeMcp() — connect startup servers, load cache
        │
        ▼
Adapter ready — tools available to agent
```

---

*Integration audit: 2026-06-26*
