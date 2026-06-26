# Codebase Structure

**Analysis Date:** 2026-06-26

## Directory Layout

```
mcp-adapter/
├── adapters/              # Agent-specific adapter implementations + universal entry point
│   ├── entry.ts           # Universal createMcpAdapter() — agent-agnostic registration hub
│   ├── pi-adapter.ts      # Pi pass-through adapter (wraps ExtensionAPI → AgentAPI)
│   ├── qoder-adapter.ts   # Qoder in-memory adapter (Map-based store)
│   ├── kilo-adapter.ts    # Kilo in-memory adapter (mirrors Qoder pattern)
│   ├── pi-renderer.ts     # Pi Text renderer wrapper
│   ├── pi-sampling-provider.ts  # Pi-native sampling provider
│   ├── qoder-renderer.ts  # Qoder Text renderer (thin pass-through)
│   └── qoder-sampling-provider.ts # Qoder-native sampling provider
│
├── interfaces/            # Agent-agnostic contract definitions
│   ├── agent-api.ts       # AgentAPI, AgentContext, UISystem, ToolRegistration, AGENT_ADAPTERS registry
│   ├── agent-channel.ts   # AgentChannel — bidirectional comm channel
│   ├── agent-paths.ts     # AgentPathResolver, per-agent config path resolution
│   └── sampling.ts        # SamplingProvider, SamplingModel, SamplingRequest/Response
│
├── bin/                   # Standalone binary entry points
│   ├── kilo-mcp-server.ts # Kilo MCP server bridge (stdio + hook protocol)
│   └── qoder-mcp-bridge.ts # Qoder MCP bridge (SDK session attachment)
│
├── types/                 # Ambient type declarations for external packages
│   ├── pi-ai.d.ts         # Pi AI type stubs
│   ├── pi-coding-agent.d.ts # Pi coding agent type stubs
│   └── pi-tui.d.ts        # Pi TUI type stubs
│
├── __tests__/             # Unit and integration tests (~51 test files)
│   ├── adapter-contract.test.ts  # Parametric contract tests across AGENT_ADAPTERS
│   ├── entry.test.ts      # createMcpAdapter registration tests
│   ├── pi-adapter.test.ts # PiAdapter unit tests
│   ├── qoder-adapter.test.ts    # QoderAdapter unit tests
│   ├── qoder-adapter-integration.test.ts # Qoder integration tests
│   ├── server-manager-*.test.ts  # Server manager tests
│   ├── ui-server.test.ts  # UI server tests (31 KB — most comprehensive)
│   ├── ui-integration.test.ts    # UI integration tests
│   ├── proxy-modes-*.test.ts     # Proxy mode tests
│   ├── direct-tools-*.test.ts    # Direct tools tests
│   ├── mcp-auth-*.test.ts        # OAuth flow tests
│   ├── integration.test.ts # General integration tests
│   ├── fixtures/          # Test fixture data
│   └── compatibility/     # Compatibility test helpers
│
├── tests/                 # Demo servers, E2E scenarios, smoke tests
│   ├── TESTING.md         # Internal testing guide
│   ├── global-setup.ts    # Test global setup
│   ├── agent-scenarios/   # Per-agent scenario tests
│   ├── demo-servers/      # Mock MCP servers for integration testing
│   ├── smoke/             # Smoke test harnesses
│   ├── compatibility/     # Cross-agent compatibility tests
│   ├── reporters/         # Custom vitest reporters (matrix-reporter)
│   ├── reports/           # Generated test reports
│   ├── token-benchmark/   # Token usage benchmarks
│   └── fixtures/          # Shared test fixtures
│
├── .planning/             # Project planning documents (GSD-managed)
│   ├── codebase/          # Generated codebase map (ARCHITECTURE.md, STRUCTURE.md, etc.)
│   ├── phases/            # Phase implementation plans
│   ├── milestones/        # Milestone tracking
│   ├── PROJECT.md         # Project overview
│   ├── ROADMAP.md         # Feature roadmap
│   ├── MILESTONES.md      # Milestone summaries
│   └── STATE.md           # Current project state
│
├── docs/                  # User-facing documentation
├── examples/              # Example projects (interactive-visualizer)
├── scripts/               # Build/deploy/verification scripts
├── skills/                # Agent skills definitions
├── .kilo/                 # Kilo agent configuration
├── .claude/               # Claude agent configuration
├── coverage/              # Test coverage output (generated, gitignored)
│
├── index.ts               # Pi extension entry point (default export mcpAdapter)
├── cli.js                 # CLI entry point (pi-mcp-adapter binary)
├── config.ts              # Multi-source MCP config loading + merging (675 lines)
├── state.ts               # McpExtensionState type definition
├── init.ts                # MCP bootstrap: config loading, server connection, metadata build
├── server-manager.ts      # MCP client connection management (connect, close, transport)
├── lifecycle.ts           # Server lifecycle: health checks, idle timeout, graceful shutdown
├── proxy-modes.ts         # Proxy tool execution: call, connect, describe, search, list, status (836 lines)
├── direct-tools.ts        # Direct tool registration + execution (429 lines)
├── commands.ts            # CLI commands: status, tools, reconnect, auth, panels (421 lines)
├── types.ts               # Core type definitions: McpConfig, ServerEntry, ToolMetadata, etc. (465 lines)
│
├── ui-server.ts           # Embedded HTTP server for interactive MCP tool UIs (624 lines)
├── ui-session.ts          # UI session management (start, reuse, message tracking)
├── ui-resource-handler.ts # UI resource resolution for app-enabled tools
├── ui-stream-types.ts     # UI streaming protocol type definitions + schemas
├── host-html-template.ts  # HTML host template for embedding tool iframes
├── tool-result-renderer.ts # Tool call/result renderers for proxy and direct tools
├── glimpse-ui.ts          # Glimpse UI integration
│
├── mcp-auth-flow.ts       # OAuth 2.1 authentication flow orchestration
├── mcp-oauth-provider.ts  # SDK OAuth provider (token lifecycle, refresh)
├── mcp-auth.ts            # OAuth token storage (disk persistence)
├── mcp-callback-server.ts # OAuth callback HTTP server
├── oauth-handler.ts       # OAuth handler entry point wrapper
│
├── mcp-panel.ts           # TUI panel for MCP server management (28 KB)
├── mcp-setup-panel.ts     # TUI panel for MCP setup wizard (20 KB)
│
├── metadata-cache.ts      # Tool metadata disk cache (serialize/deserialize, hash validation)
├── tool-metadata.ts       # Tool metadata construction + search utilities
├── tool-registrar.ts      # Tool registration helpers + MCP content transformation
├── resource-tools.ts      # Resource-to-tool name mapping
├── sampling-handler.ts    # MCP sampling handler registration
├── elicitation-handler.ts # MCP elicitation handler (form + URL)
├── consent-manager.ts     # Per-server tool usage consent tracking
├── npx-resolver.ts        # npx/npm binary resolution for stdio transports
├── onboarding-state.ts    # Persistent onboarding state (setup completion tracking)
├── agent-dir.ts           # Agent directory resolution (MCP_AGENT_DIR, PI_CODING_AGENT_DIR)
├── utils.ts               # Shared utilities: env interpolation, URL opening, text truncation
├── logger.ts              # Structured logging with contextual child loggers
├── errors.ts              # Custom error classes (ServerError) + wrapError helper
│
├── package.json           # Package manifest (name: pi-mcp-adapter, v2.9.0)
├── tsconfig.json          # TypeScript config (ES2022, NodeNext module)
├── vitest.config.ts       # Vitest config with threshold-based coverage
├── .mcp.json              # Project's own MCP config (dogfooding)
├── app-bridge.bundle.js   # Pre-bundled AppBridge module for iframe UIs
├── pi-mcp.mp4             # Demo video
├── banner.png             # Project banner
├── README.md              # User-facing documentation (28 KB)
├── AGENTS.md / CLAUDE.md  # Agent instruction files
├── CHANGELOG.md           # Version changelog (20 KB)
├── MAPPING.md             # Codebase mapping documentation
└── OAUTH.md               # OAuth integration documentation (12 KB)
```

## Directory Purposes

### `adapters/`
- Purpose: Agent-specific bridge implementations + the universal `createMcpAdapter` entry point
- Contains: Adapter classes (`PiAdapter`, `QoderAdapter`, `KiloAdapter`) implementing `AgentAPI`, plus agent-specific sampling providers and renderers
- Key files: `entry.ts` (universal adapter hub), `pi-adapter.ts`, `qoder-adapter.ts`, `kilo-adapter.ts`

### `interfaces/`
- Purpose: Define the agent-agnostic contract that isolates the core MCP logic from agent-specific APIs
- Contains: `AgentAPI` (8 required methods), `AgentContext`, `UISystem`, `AgentChannel`, `SamplingProvider`, `AgentPathResolver`, `AGENT_ADAPTERS` registry
- Key files: `agent-api.ts` (core contract + static adapter registry)

### `bin/`
- Purpose: Standalone binary entry points for agent hosts that require a separate server process
- Contains: `kilo-mcp-server.ts` (Kilo stdio bridge), `qoder-mcp-bridge.ts` (Qoder SDK bridge)
- Key files: Both are ~6 KB each — lightweight bridges

### `__tests__/` and `tests/`
- Purpose: Test infrastructure
- Contains: `__tests__/` has ~51 unit/integration test files co-located as `*.test.ts`; `tests/` has demo servers, E2E scenarios, smoke tests, reporters, benchmarks
- Key files: `adapter-contract.test.ts` (parametric AGENT_ADAPTERS tests), `entry.test.ts`, `ui-server.test.ts` (31 KB), `integration.test.ts`

### Root `.ts` files
- Purpose: Core application logic — config, state, lifecycle, MCP tool execution, commands, types
- Contains: `index.ts` (Pi entry point), `init.ts`, `config.ts`, `state.ts`, `server-manager.ts`, `lifecycle.ts`, `proxy-modes.ts`, `direct-tools.ts`, `commands.ts`, `types.ts`
- Key files: `config.ts` (675 lines — multi-source config with imports), `proxy-modes.ts` (836 lines — proxy tool execution)

### Auth files
- Purpose: OAuth 2.1 authentication for MCP servers
- Contains: `mcp-auth-flow.ts` (orchestration), `mcp-oauth-provider.ts` (SDK auth provider), `mcp-auth.ts` (token storage), `mcp-callback-server.ts` (HTTP callback), `oauth-handler.ts` (entry wrapper)

### UI files
- Purpose: Interactive server management panels, setup wizards, embedded browser for tool UIs
- Contains: `ui-server.ts` (embedded HTTP server), `ui-session.ts`, `mcp-panel.ts` (28 KB TUI), `mcp-setup-panel.ts` (20 KB TUI), `host-html-template.ts`, `tool-result-renderer.ts`

## Key File Locations

**Entry Points:**
- `index.ts`: Pi extension default export (`mcpAdapter` function)
- `cli.js`: CLI binary entry (`pi-mcp-adapter`)
- `bin/kilo-mcp-server.ts`: Kilo agent MCP server bridge
- `bin/qoder-mcp-bridge.ts`: Qoder agent MCP bridge

**Configuration:**
- `config.ts`: Config loading, merging, import expansion, discovery, write previews
- `agent-dir.ts`: Agent directory resolution (`MCP_AGENT_DIR`, `PI_CODING_AGENT_DIR` env vars)
- `interfaces/agent-paths.ts`: Per-agent config path resolution (`AgentPathResolver`)
- `.mcp.json`: Project-level MCP config (dogfooding)

**Core Logic:**
- `adapters/entry.ts`: `createMcpAdapter()` — universal registration hub
- `init.ts`: `initializeMcp()` — bootstrap, server connection, metadata build
- `server-manager.ts`: `McpServerManager` — client lifecycle, transport negotiation
- `proxy-modes.ts`: `executeCall`, `executeConnect`, `executeDescribe`, `executeSearch`, `executeList`, `executeStatus`, `executeUiMessages`
- `direct-tools.ts`: `resolveDirectTools`, `createDirectToolExecutor`, `buildProxyDescription`
- `state.ts`: `McpExtensionState` type definition

**Auth:**
- `mcp-auth-flow.ts`: `authenticate()`, `removeAuth()`, `supportsOAuth()`, `extractOAuthConfig()`
- `mcp-oauth-provider.ts`: `McpOAuthProvider` class (SDK auth provider)
- `mcp-auth.ts`: `getAuthForUrl()`, token persistence

**UI:**
- `ui-server.ts`: `startUiServer()` — embedded HTTP server with SSE + proxy endpoints
- `ui-session.ts`: `maybeStartUiSession()` — session reuse, message tracking
- `mcp-panel.ts`: `createMcpPanel()` — TUI server management panel
- `mcp-setup-panel.ts`: `createMcpSetupPanel()` — TUI setup wizard

**Testing:**
- `__tests__/adapter-contract.test.ts`: Parametric tests over `AGENT_ADAPTERS`
- `__tests__/entry.test.ts`: `createMcpAdapter` registration tests
- `__tests__/ui-server.test.ts`: UI server behavior (31 KB)
- `tests/demo-servers/`: Mock MCP servers for integration tests
- `vitest.config.ts`: Test runner config with per-file coverage thresholds

**Shared Utilities:**
- `utils.ts`: `interpolateEnvRecord()`, `resolveBearerToken()`, `resolveConfigPath()`, `openUrl()`, `openPath()`, `truncateAtWord()`, `formatAuthRequiredMessage()`
- `logger.ts`: Structured logger with child loggers
- `errors.ts`: `ServerError`, `wrapError`
- `metadata-cache.ts`: Disk cache for tool metadata (serialize/deserialize, hash-based invalidation)
- `tool-metadata.ts`: `buildToolMetadata()`, `findToolByName()`, `formatSchema()`
- `tool-registrar.ts`: `transformMcpContent()` (MCP content → agent tool result blocks)
- `npx-resolver.ts`: Resolve `npx`/`npm` binaries to actual executable paths
- `consent-manager.ts`: Per-server tool consent tracking
- `sampling-handler.ts`: MCP sampling capability registration
- `elicitation-handler.ts`: MCP elicitation (form + URL) capability registration

## Naming Conventions

**Files:**
- **Adapter classes:** `{agent}-adapter.ts` (kebab-case agent name + `-adapter` suffix)
- **Agent-specific providers:** `{agent}-sampling-provider.ts`, `{agent}-renderer.ts`
- **Core modules:** descriptive kebab-case: `proxy-modes.ts`, `direct-tools.ts`, `server-manager.ts`, `metadata-cache.ts`
- **Test files:** `{module}.test.ts` co-located with source files or in `__tests__/`
- **Binaries:** `{agent}-mcp-server.ts`, `{agent}-mcp-bridge.ts`

**Directories:**
- All lowercase, kebab-case where multi-word: `adapters/`, `interfaces/`
- Test directory: `__tests__/` (double-underscore prefix, vitest convention)
- Demo/E2E: `tests/` (no prefix, contains recursive subdirs)

**Functions:**
- camelCase: `createMcpAdapter`, `loadMcpConfig`, `initializeMcp`, `executeCall`, `buildProxyDescription`
- Factory functions prefixed with `create`: `createMcpAdapter`, `createDirectToolExecutor`, `createPiResolver`, `createQoderResolver`
- Context adapters prefixed with `adapt`: `adaptPiContext`, `adaptQoderContext`, `adaptKiloContext`
- Boolean checks prefixed with `is` or `supports`: `isServerCacheValid`, `supportsOAuth`, `isToolExcluded`

**Types/Interfaces:**
- PascalCase: `AgentAPI`, `AgentContext`, `McpExtensionState`, `ServerEntry`, `McpConfig`
- `I` prefix NOT used
- Type aliases use same PascalCase: `Transport`, `ImportKind`, `SendMessageFn`

**Exports:**
- `export default` for the Pi extension entry point: `export default function mcpAdapter(pi)`
- Named exports for everything else: `export class PiAdapter`, `export function createMcpAdapter`
- Barrel re-exports in `index.ts` for public API surface

## Where to Add New Code

**New Agent Adapter:**
- Primary code: `adapters/{agent}-adapter.ts` — implement `AgentAPI` (8 methods)
- Optional: `adapters/{agent}-sampling-provider.ts` if agent has native sampling
- Optional: `adapters/{agent}-renderer.ts` if agent has custom text rendering
- Registration: Add one descriptor to `AGENT_ADAPTERS` array in `interfaces/agent-api.ts`
- Config path: Add resolver factory to `interfaces/agent-paths.ts`
- Binary entry: `bin/{agent}-mcp-bridge.ts` if agent needs a standalone server
- Tests: `__tests__/{agent}-adapter.test.ts`

**New MCP Feature:**
- Primary code: New `.ts` file at root or in a subdirectory
- Types: Add to `types.ts` or new `types/{feature}.ts`
- Tests: `__tests__/{feature}.test.ts`
- Wiring: Call from `createMcpAdapter()` in `adapters/entry.ts` or `initializeMcp()` in `init.ts`

**New UI Panel:**
- Implementation: `mcp-{panel-name}-panel.ts` at root
- Registration: Wire into `commands.ts` (e.g., `openMcpPanel`, `openMcpSetup`)
- Tests: `__tests__/{panel-name}.test.ts`

**Utilities:**
- Shared helpers: `utils.ts` for small functions; new dedicated file for larger modules
- Logging: Use `logger.ts` child loggers; never `console.log` directly

## Special Directories

**`node_modules/`:**
- Purpose: Dependencies (npm-managed)
- Generated: Yes (npm install)
- Committed: No (gitignored)

**`coverage/`:**
- Purpose: Test coverage reports (v8 provider)
- Generated: Yes (vitest --coverage)
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD-managed planning documents, phase plans, codebase map
- Generated: Semi-generated (GSD commands write here)
- Committed: Yes

**`tests/reports/`:**
- Purpose: Test matrix reports (agent × section compatibility)
- Generated: Yes (matrix-reporter on test run)
- Committed: Yes (checked in for visibility)

**`types/`:**
- Purpose: Ambient TypeScript declarations for external packages (`.d.ts` files)
- Contains: `pi-ai.d.ts`, `pi-coding-agent.d.ts`, `pi-tui.d.ts` — type stubs for Pi ecosystem
- Generated: No (hand-maintained)
- Committed: Yes

---

*Structure analysis: 2026-06-26*
