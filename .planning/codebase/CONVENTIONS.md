# Coding Conventions

**Analysis Date:** 2026-06-26

## Naming Patterns

**Files:**
- Source files: predominantly kebab-case (`proxy-modes.ts`, `server-manager.ts`, `mcp-auth-flow.ts`, `ui-server.ts`, `direct-tools.ts`, `tool-registrar.ts`, `npx-resolver.ts`, `ui-resource-handler.ts`, `consent-manager.ts`, `elicitation-handler.ts`, `sampling-handler.ts`, `tool-result-renderer.ts`, `metadata-cache.ts`, `onboarding-state.ts`, `mcp-setup-panel.ts`, `mcp-panel.ts`, `mcp-oauth-provider.ts`, `mcp-callback-server.ts`, `oauth-handler.ts`, `host-html-template.ts`, `glimpse-ui.ts`, `resource-tools.ts`, `ui-stream-types.ts`, `ui-session.ts`)
- Some single-word files: `types.ts`, `config.ts`, `errors.ts`, `logger.ts`, `state.ts`, `utils.ts`, `index.ts`, `init.ts`, `commands.ts`, `lifecycle.ts`, `tool-metadata.ts`, `agent-dir.ts`, `mcp-auth.ts`
- Test files: `[feature].test.ts` (`config.test.ts`, `pi-adapter.test.ts`, `ui-server.test.ts`)
- Fixture files: kebab-case with descriptive suffix (`mock-agent-api.ts`)
- Interface files: kebab-case (`agent-api.ts`, `agent-paths.ts`, `agent-channel.ts`, `sampling.ts`)

**Functions:**
- camelCase throughout (`createMcpAdapter`, `adaptPiContext`, `loadMcpConfig`, `formatToolName`, `getServerPrefix`, `interpolateEnvVars`, `truncateAtWord`, `resolveBearerToken`, `extractUiPromptText`, `parseUiPromptHandoff`, `isToolExcluded`, `createDeferred`)
- Factory/constructor functions prefixed with `create` (`createMcpAdapter`, `createPiResolver`, `createQoderResolver`, `createKiloResolver`, `createDirectToolExecutor`, `createMcpDirectToolCallRenderer`)
- Conversion functions prefixed with `adapt` (`adaptPiContext`, `adaptQoderContext`, `adaptPiUI`, `adaptQoderUI`)
- Helper factories in tests: `makePiMock()`, `makeFakeChild()`, `createAgentApi()`, `createState()`, `createPi()`

**Variables:**
- camelCase (`agentapi`, `sessionCtx`, `lifecycleGeneration`, `parsedArgs`, `earlyConfig`)
- Private class members use `private readonly` with camelCase (`this.queryRef`, `this.channel`, `this.bufferedMessages`)
- Constructor parameters use leading underscore when unused (`_ctx`, `_toolCallId`, `_signal`, `_onUpdate`, `_options`)

**Types and Interfaces:**
- PascalCase for all types/interfaces (`AgentAPI`, `AgentContext`, `UISystem`, `ToolRegistration`, `CommandConfig`, `FlagConfig`, `McpConfig`, `ServerEntry`, `McpTool`, `McpResource`, `UiResourceContent`, `UiHostContext`, `LogEntry`, `LogContext`, `McpUiErrorContext`)
- Union types as `type` aliases in PascalCase (`Transport`, `ImportKind`, `ContentBlock`, `UiDisplayMode`)
- Class names in PascalCase (`PiAdapter`, `QoderAdapter`, `KiloAdapter`, `Logger`, `ChildLogger`, `McpUiError`, `ResourceFetchError`)

**Constants:**
- SCREAMING_SNAKE_CASE at module level (`LEVEL_PRIORITY`, `LEVEL_PREFIX`, `PROJECT_ROOT`, `REPORT_DIR`, `SEND_BUFFER_LIMIT`)
- Single static registry: `AGENT_ADAPTERS` (PascalCase for const array)

**Test Names:**
- `describe()` blocks: feature/component name (`"PiAdapter"`, `"UiServer"`, `"QoderAdapter - AgentAPI surface"`)
- `it()` blocks: descriptive phrase starting with verb (`"forwards registerTool by name"`, `"rejects invalid session token"`, `"wraps tool execute to convert Pi ExtensionContext to AgentContext"`)
- Numbered tests in contract files (`"Test 1: exposes all 8 required methods as functions"`)

## Code Style

**Formatting:**
- No explicit formatter configured — no `.eslintrc`, `.prettierrc`, or `biome.json` found
- Indentation: mixed — 2-space (most newer files) and tab-based (older files) observed. Files like `adapters/entry.ts`, `adapters/qoder-adapter.ts`, `interfaces/agent-api.ts` use tabs; `__tests__/ui-server.test.ts`, `config.ts`, `logger.ts` use 2-space
- Semicolons: consistently used at statement ends
- Trailing commas: not consistently applied
- Quoting: single quotes for strings (`.ts` imports use single quotes)

**Linting:**
- No linter configuration detected in the repository
- `tsconfig.json` has `strict: false`, `skipLibCheck: true`
- TypeScript compiles with `noEmit: true`

**TypeScript Configuration:**
- Target: `ES2022`
- Module: `NodeNext`
- Module resolution: `NodeNext`
- `allowImportingTsExtensions: true` — `.ts` extensions required in imports
- `esModuleInterop: true`
- `resolveJsonModule: true`
- Compiler `include`: `*.ts`, `interfaces/**/*.ts`, `adapters/**/*.ts`, `types/**/*.ts`

## Import Organization

**Order (observed pattern):**
1. External npm package imports (`vitest`, `node:os`, node built-ins)
2. Type-only imports from internal modules (`import type { ... } from "../interfaces/agent-api.ts"`)
3. Internal module imports (`import { ... } from "../adapters/entry.ts"`)

**Type Imports:**
- `import type` used consistently for type-only imports to ensure tree-shaking
- Examples:
  ```typescript
  import type { AgentAPI, AgentContext, UISystem } from "../interfaces/agent-api.ts";
  import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
  ```

**Path Aliases:**
- No path aliases configured — all imports are relative (`../`, `../../`)
- `tsconfig.json` has no `paths` defined

**File Extensions:**
- `.ts` extensions are explicitly included in all imports due to `allowImportingTsExtensions`
  ```typescript
  import { loadMcpConfig } from "./config.ts";
  import { PiAdapter } from "../adapters/pi-adapter.ts";
  ```

**Dynamic Imports:**
- Used in `QoderAdapter.exec()` for `node:child_process` (tree-shaking optimization):
  ```typescript
  const cp = (await import("node:child_process")) as typeof import("node:child_process");
  ```

## Error Handling

**Custom Error Hierarchy:**
- `McpUiError` base class with `code`, `context`, `recoveryHint`, `cause` in `errors.ts`
- Specialized subclasses: `ResourceFetchError`, `ResourceParseError`, `BridgeConnectionError`, `ConsentError`, `SessionError`, `ServerError`, `McpServerError`
- Constructor pattern:
  ```typescript
  class ResourceFetchError extends McpUiError {
    constructor(uri: string, reason: string, options?: { server?: string; cause?: Error }) {
      super(`Failed to fetch UI resource "${uri}": ${reason}`, {
        code: "RESOURCE_FETCH_ERROR",
        context: { uri, server: options?.server },
        recoveryHint: "Check that the MCP server is connected and the resource URI is valid.",
        cause: options?.cause,
      });
      this.name = "ResourceFetchError";
    }
  }
  ```

**Error Wrapping:**
- `wrapError(error, context?)` in `errors.ts` wraps unknown errors into `McpUiError`
- `isErrorCode(error, code)` for checking specific error codes
- Errors use `Error.captureStackTrace` when available

**Try/Catch patterns:**
- Non-critical failures use `console.error()` and continue:
  ```typescript
  } catch (error) {
    console.error("MCP: failed to shut down previous session state", error);
  }
  ```
- Async initialization errors caught and logged:
  ```typescript
  .catch((err) => {
    if (generation !== lifecycleGeneration) return;
    console.error("MCP initialization failed:", err);
  });
  ```

**Error messages in tests:**
- Use `expect().rejects.toThrow()` for error assertions
- Error messages are checked for specific strings:
  ```typescript
  await expect(adapter.exec("nope", [])).rejects.toThrow("spawn failed");
  ```

## Logging

**Custom Logger (`logger.ts`):**
- Singleton `Logger` instance exported as `logger`
- Levels: `debug` | `info` | `warn` | `error`
- Console mapping: error→console.error, warn→console.warn, debug→console.debug, info→console.log
- Level prefix: `[MCP-UI:DEBUG]`, `[MCP-UI]`, `[MCP-UI:WARN]`, `[MCP-UI:ERROR]`
- Debug mode activated via `MCP_UI_DEBUG=1` or `MCP_UI_DEBUG=true`
- `ChildLogger` for scoped contexts with additional default context

**Agent-specific logging:**
- Qoder adapter: `[mcp-adapter/qoder]` prefix in `console.info`/`console.warn`/`console.error`
- Qoder notify: `console[consoleMethod](`[mcp-adapter/qoder] ${message}`)`

**Log Context:**
```typescript
export interface LogContext {
  server?: string;
  session?: string;
  tool?: string;
  uri?: string;
  [key: string]: unknown;
}
```

## Comments

**JSDoc / Block Comments:**
- Used extensively on public APIs, classes, and exported functions
- Decision tracking: references to D-XX (design decisions), REQ-XX (requirements), T-XX (threat model)
- Phase references (e.g., `Per D-07 (Phase 7)`)
- Examples:
  ```typescript
  /**
   * Core agent API surface required by the universal MCP adapter.
   *
   * All methods are required to enforce a minimum contract across agents.
   * Per-agent extensions belong on the concrete adapter class, not here.
   */
  export interface AgentAPI { ... }
  ```

**Inline Comments:**
- Explanatory comments on non-obvious logic
- Trust boundary / threat-model annotations (T-06-02, T-06-04)
- Cast boundary explanations (`// Pi's registerTool has a strict generic; cast at the boundary`)
- In tests: comments for opt-in behavior (`// hasUI = false so we focus on plumbing`)

## Function Design

**Size:**
- Most functions are 5–30 lines
- Complex functions like `createMcpAdapter` are ~300 lines (registers all tools/commands/flags/lifecycle)
- Adapter `exec()` methods are 25-50 lines

**Parameters:**
- Options objects for functions with many parameters or optional config:
  ```typescript
  constructor(message: string, options: {
    code: string;
    context?: McpUiErrorContext;
    recoveryHint?: string;
    cause?: Error;
  })
  ```
- Unused parameters prefixed with underscore (`_ctx`, `_toolCallId`, `_signal`)

**Return Values:**
- Functions return `Promise<T>` for async operations
- Factory functions return constructed objects
- Conversion functions (`adaptXxx`) return the adapted type

**Async Patterns:**
- `async/await` used throughout
- `Promise.all()` for parallel execution
- `createDeferred<T>()` for testing async race conditions:
  ```typescript
  function createDeferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => { resolve = res; });
    return { promise, resolve };
  }
  ```

## Module Design

**Exports:**
- Named exports preferred for most modules
- Default export only for `index.ts` (`mcpAdapter` function) and `cli.js`
- Re-exports from central `index.ts`:
  ```typescript
  export { PiAdapter, adaptPiContext };
  export { DEFAULT_AGENT_RESOLVER, createPiResolver, resolveAgentGlobalConfigPath } from "./interfaces/agent-paths.ts";
  export type { AgentAPI, AgentContext, UISystem } from "./interfaces/agent-api.ts";
  ```

**Barrel Files:**
- `index.ts` serves as barrel for public API
- `types.ts` serves as barrel re-exporting from `ui-stream-types.ts`

**Module Organization:**
- Source root (`/`): Top-level feature files (flat)
- `adapters/`: Agent adapter implementations (8 files)
- `interfaces/`: Agent-agnostic contracts (4 files)
- `types/`: Additional type definitions (3 files)
- `scripts/`: Build/CI scripts (4 files)
- `bin/`: CLI entry points (2 files)
- `skills/`: Agent skills (4 subdirectories)

## Key Architectural Patterns

**Agent Adapter Pattern:**
- `AgentAPI` interface defines the universal contract (8 methods: `registerTool`, `registerCommand`, `registerFlag`, `on`, `getAllTools`, `getFlag`, `sendMessage`, `exec`)
- Each agent gets an adapter class implementing `AgentAPI`
- `AGENT_ADAPTERS` static registry in `interfaces/agent-api.ts` for discovery
- `createMcpAdapter()` in `adapters/entry.ts` wires up the universal adapter

**Static Registry Pattern:**
```typescript
export const AGENT_ADAPTERS: AgentAdapterDescriptor[] = [
  { id: "kilo", displayName: "Kilo", factory: () => new KiloAdapter(), ... },
  { id: "pi", displayName: "Pi", factory: () => new PiAdapter(...), ... },
  { id: "qoder", displayName: "Qoder", factory: () => new QoderAdapter(), ... },
];
```

**Design Decision References:**
- D-01: `sendMessage` uses `unknown` parameters
- D-02: `exec` returns `Promise<unknown>`
- D-03: All `AgentAPI` methods required
- D-04: `UISystem.notify` required; others optional
- D-07: New adapter = push one descriptor to `AGENT_ADAPTERS`

**Threat Model Annotations:**
- T-06-02: Information disclosure — no raw logger outside allowed channels
- T-06-04: Elevation of privilege — `exec` only from trusted host code

## TypeScript Patterns

**`unknown` for Cross-Agent Compatibility:**
```typescript
sendMessage(message: unknown, options?: unknown): void;
exec(command: string, args: string[]): Promise<unknown>;
```

**Optional UI Members:**
```typescript
export interface UISystem {
  notify(message: string, level: "info" | "warning" | "error"): void;
  setStatus?(key: string, value: string | undefined): void;
  form?(config: FormConfig): Promise<FormResult>;
  custom?(renderer: UIRenderer, options?: UIOptions): void;
  theme?: { fg?(color: string, text: string): string };
}
```

**Cast Boundaries:**
- Adapter methods cast at the boundary between generic and agent-specific types:
  ```typescript
  (this.pi.registerTool as (tool: ToolRegistration) => unknown)(this.adaptTool(tool));
  ```

---

*Convention analysis: 2026-06-26*
