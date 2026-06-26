# AgentAPI Implementation Guide

Complete guide for implementing a custom adapter that conforms to the `AgentAPI` interface. Source of truth: `interfaces/agent-api.ts`.

## The Contract

`AgentAPI` has 8 required methods. No method is optional.

```typescript
interface AgentAPI {
  registerTool(tool: ToolRegistration): void;
  registerCommand(name: string, config: CommandConfig): void;
  registerFlag(name: string, config: FlagConfig): void;
  on(event: string, handler: (...args: unknown[]) => void | Promise<void>): void;
  getAllTools(): ToolInfo[];
  getFlag(name: string): string | undefined;
  sendMessage(message: unknown, options?: unknown): void;
  exec(command: string, args: string[]): Promise<unknown>;
}
```

## Method Reference

### registerTool(tool: ToolRegistration)

Called by `createMcpAdapter` to register the `mcp` proxy tool and any direct tools.

```typescript
interface ToolRegistration {
  name: string;           // e.g. "mcp", "calculator_add"
  label?: string;
  description?: string;
  promptSnippet?: string;
  parameters?: unknown;   // JSON Schema for the tool's parameters
  execute: (...args: unknown[]) => unknown;  // Tool call handler
  renderCall?: (...args: unknown[]) => unknown;   // Optional: custom call rendering
  renderResult?: (...args: unknown[]) => unknown;  // Optional: custom result rendering
}
```

**Implementation patterns**:
- **Pass-through** (Pi): delegate to agent's native `registerTool`
- **In-memory store** (Qoder): store in a `Map<string, ToolRegistration>`, bridge to SDK later

### registerCommand(name: string, config: CommandConfig)

Registers slash commands (`/mcp`, `/mcp-auth`).

```typescript
interface CommandConfig {
  description?: string;
  handler: (...args: unknown[]) => unknown;
}
```

**Implementation patterns**:
- **Pass-through** (Pi): delegate to agent's native command system
- **In-memory store** (Qoder): store in Map; host bridges to agent's command surface

### registerFlag(name: string, config: FlagConfig)

Registers flags the adapter reads via `getFlag()`. The `mcp-config` flag lets users override the config path.

```typescript
interface FlagConfig {
  description?: string;
  type?: string;
}
```

**Implementation**: Store flag name + config in a Map. The adapter will later call `getFlag(name)` to read the value.

### on(event: string, handler)

Registers event handlers. Events fired by `createMcpAdapter`:

| Event | When | Args |
|-------|------|------|
| `session_start` | Agent session begins | `AgentContext` |
| `session_shutdown` | Agent session ends | (none) |
| `tool_registered` | A tool is registered | tool name (string) |

**Implementation patterns**:
- **Pass-through** (Pi): delegate to agent's `on()` method
- **Set-based registry** (Qoder): `Map<string, Set<handler>>` — Set prevents double-registration

### getAllTools(): ToolInfo[]

Returns all registered tools. Used by the Capability Gate to detect Path A/B/C.

```typescript
interface ToolInfo {
  name: string;
  [key: string]: unknown;
}
```

**Implementation**: Return array of `{ name }` from your tool store.

### getFlag(name: string): string | undefined

Returns the current value of a previously registered flag.

**Implementation**: Look up flag in your flag store, return its value (or undefined).

### sendMessage(message: unknown, options?: unknown)

Sends a message through the agent's communication channel (e.g. streaming to the LLM).

**Implementation patterns**:
- **Pass-through** (Pi): delegate to agent's `sendMessage`
- **SDK bridge** (Qoder): route through `Query.streamInput` when a Query is attached; buffer otherwise

### exec(command: string, args: string[]): Promise<unknown>

Runs a shell command. Used by auth flows and setup wizards.

**Implementation**: Use `node:child_process.spawn`. Return `{ code, stdout, stderr }`.

**Security**: MUST only be called from trusted host code (auth-flow, setup, lifecycle). NEVER expose to MCP tool results.

## UISystem (Optional)

```typescript
interface UISystem {
  notify(message: string, level: "info" | "warning" | "error"): void;  // Required
  setStatus?(key: string, value: string | undefined): void;             // Optional
  form?(config: FormConfig): Promise<FormResult>;                       // Optional
  custom?(renderer: UIRenderer, options?: UIOptions): void;            // Optional
  theme?: { fg?(color: string, text: string): string };                // Optional
}
```

| Method | Pi | Qoder | Use case |
|--------|-----|-------|----------|
| `notify` | Full | Console.log | Transient notifications |
| `setStatus` | Full | Absent | Status bar entries |
| `form` | Full | Absent | Interactive forms (elicitation) |
| `custom` | Full | Absent | Custom UI rendering |
| `theme.fg` | Full | Absent | Colored text output |

**Minimal implementation** (Qoder-style):
```typescript
readonly ui: UISystem = {
  notify: (message, level) => {
    const method = level === "error" ? "error" : level === "warning" ? "warn" : "info";
    console[method](`[mcp-adapter] ${message}`);
  },
  setStatus: undefined,
  form: undefined,
  custom: undefined,
  theme: undefined,
};
```

## AgentContext

```typescript
interface AgentContext {
  cwd: string;            // Required: working directory
  hasUI: boolean;         // Required: whether UI is available
  ui?: UISystem;          // Optional: UI surface (when hasUI is true)
  model?: unknown;        // Optional: current model identifier
  modelRegistry?: unknown;// Optional: model registry
  samplingProvider?: SamplingProvider; // Optional: for MCP sampling
  signal?: AbortSignal;   // Optional: for cancellation
  reload?: () => Promise<void>; // Optional: reload agent config
}
```

## AgentPathResolver

```typescript
interface AgentPathResolver {
  readonly agentId: AgentId;
  globalConfigPath(): string;       // Absolute path to global mcp.json
  projectConfigName?(): string;     // Project config filename (default: ".mcp.json")
}
```

**Implementation example**:
```typescript
const myResolver: AgentPathResolver = {
  agentId: "my-agent",
  globalConfigPath: () => join(homedir(), ".my-agent", "mcp.json"),
  projectConfigName: () => ".mcp.json",
};
```

**With MCP_AGENT_DIR override** (recommended):
```typescript
function resolveGlobalPath(): string {
  const configured = process.env.MCP_AGENT_DIR?.trim();
  if (!configured) return join(homedir(), ".my-agent", "mcp.json");
  if (configured === "~") return homedir();
  if (configured.startsWith("~/")) return resolve(homedir(), configured.slice(2));
  return resolve(configured);
}
```

## Session Lifecycle

The adapter registers a `session_start` handler via `on()`. When fired:

1. `initializeMcp()` runs — spawns MCP server processes, performs handshake
2. Tool metadata is cached to disk
3. Proxy tool becomes operational
4. Direct tools are registered (if configured)

**For agents without native session events** (like Qoder), provide companion methods:

```typescript
// Public methods on your adapter (NOT part of AgentAPI)
async fireSessionStart(ctx: AgentContext): Promise<void> {
  // Invoke all handlers registered for "session_start"
  const handlers = this.handlers.get("session_start");
  if (handlers) {
    for (const h of handlers) await h(ctx);
  }
}

async fireSessionShutdown(): Promise<void> {
  const handlers = this.handlers.get("session_shutdown");
  if (handlers) {
    for (const h of handlers) await h();
  }
}
```

## Registration Flow

```
1. new MyAgentAdapter()          → create adapter instance
2. adaptContext({cwd, hasUI})    → build AgentContext
3. loadMcpConfig(path)           → load mcp.json
4. createMcpAdapter(adapter, ctx, config, cache)
   ├── adapter.registerFlag("mcp-config", ...)
   ├── adapter.registerCommand("mcp", ...)
   ├── adapter.registerCommand("mcp-auth", ...)
   ├── adapter.registerTool({name: "mcp", ...})  ← proxy tool
   ├── adapter.registerTool({name: "server_tool", ...})  ← direct tools (if configured)
   └── adapter.on("session_start", handler)  ← lazy init on session start
5. adapter.fireSessionStart(ctx) → triggers lazy server connections
6. Agent is ready — LLM sees only 1 `mcp` tool (~250 tokens)
```

## Capability Matrix

| Capability | Required | Pi | Qoder |
|-----------|----------|-----|-------|
| AgentAPI (8 methods) | Yes | Pass-through | In-memory store |
| UISystem.notify | Yes | Native | console.log |
| UISystem.form | No | Native | Absent |
| UISystem.setStatus | No | Native | Absent |
| UISystem.theme | No | Native | Absent |
| Sampling | No | PiSamplingProvider | QoderSamplingProvider |
| Renderer | No | piRenderWrapper | Absent (notify-only) |
| Session events | Yes | Native `on()` | fireSessionStart/Shutdown |
| Path resolver | Yes | createPiResolver | createQoderResolver |

## Registering in AGENT_ADAPTERS

After implementing your adapter, register it in `interfaces/agent-api.ts`:

```typescript
export const AGENT_ADAPTERS: AgentAdapterDescriptor[] = [
  // ... existing adapters
  {
    id: "my-agent",
    displayName: "MyAgent",
    factory: () => new MyAgentAdapter(),
    resolverFactory: createMyResolver,
    envHints: [{ envVar: "MY_AGENT_DIR" }],
    capabilities: { ui: false, sampling: false, renderer: false },
  },
];
```

This makes your adapter visible to:
- The `mcp-adapter-test` skill (integration testing)
- The Capability Gate (Path A/B/C detection)
- The README compatibility matrix
- The report matrix
