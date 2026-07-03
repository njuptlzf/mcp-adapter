# Deployment Code Examples

Complete code templates for Phase 2 deployment. These are referenced by SKILL.md and
read only when needed.

> **Pi users**: Pi is the origin agent. Just run `pi install npm:pi-mcp-adapter` —
> no code template needed. The examples below are for OTHER MCP-compatible agents.

---

## Universal MCP: MCP stdio server

> **When to use**: The target agent has a native MCP client and supports `mcpServers`
> config. This is the default deployment path for all MCP-compatible agents.

### Step 1: Install the package

```bash
npm install pi-mcp-adapter
# or globally: npm install -g pi-mcp-adapter
```

### Step 2: Register the server in the target agent's MCP config

In the target agent's `mcpServers` config (project `.mcp.json` or agent global config):

```json
{
  "mcpServers": {
    "mcp-adapter": {
      "command": "mcp-server"
    }
  }
}
```

### Step 3: Restart the agent

The MCP client auto-discovers the server via stdio. The `mcp` proxy tool is now
available in every session.

### How it works internally (from `bin/mcp-server.ts`)

```typescript
// 1. Load mcp.json config
const config = loadMcpConfig(); // auto-discovers .mcp.json or ~/.config/mcp/mcp.json

// 2. Create the universal adapter (agent-agnostic AgentAPI implementation)
const adapter = new UniversalMcpAdapter();
const ctx: AgentContext = { cwd: process.cwd(), hasUI: false };
const cache = loadMetadataCache();

// 3. Register everything via the universal entry point
createMcpAdapter(adapter, ctx, config, cache);

// 4. Attach an AgentChannel — routes adapter messages to stderr
const channel: AgentChannel = {
  send: (msg) => console.error(`[mcp-server] ${JSON.stringify(msg)}`),
};
adapter.attachChannel(channel);

// 5. Fire session_start → triggers lazy server connections
await adapter.fireSessionStart(ctx);

// 6. Expose registered tools to MCP via stdio
const mcpTools = [...adapter.tools.entries()].map(([name, tool]) => ({
  name,
  description: tool.description,
  inputSchema: tool.parameters,
}));

const server = new Server(
  { name: "mcp-adapter", version: "2.10.0" },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = adapter.tools.get(request.params.name);
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
  const result = await tool.execute(`call-${Date.now()}`, request.params.arguments || {}, undefined, undefined, ctx);
  return { content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result) }] };
});

// 7. Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Config path resolution per agent

| Agent | Global Config Path | Project Config |
|-------|-------------------|----------------|
| Qoder | `~/.qoder/agent/mcp.json` | `.mcp.json` |
| Claude Code | `~/.claude/agent/mcp.json` | `.mcp.json` |
| Cursor | `~/.cursor/mcp.json` | `.mcp.json` |
| Kilo | `~/.kilo/mcp.json` | `.mcp.json` |
| (universal) | `~/.config/mcp/mcp.json` | `.mcp.json` |

Override: `MCP_AGENT_DIR=/custom/path`

---

## Custom Agent (advanced)

> **When to use**: The target agent is NOT in the known config paths table above
> and requires a custom `AgentAPI` implementation. This is the only path that
> requires writing new code before deployment.

```typescript
// my-agent-mcp-adapter.ts
import { createMcpAdapter } from "pi-mcp-adapter/adapters/entry.ts";
import { loadMcpConfig } from "pi-mcp-adapter/config.ts";
import type {
  AgentAPI, AgentContext, ToolRegistration, ToolInfo,
  CommandConfig, FlagConfig, UISystem
} from "pi-mcp-adapter/interfaces/agent-api.ts";
import type { AgentPathResolver } from "pi-mcp-adapter/interfaces/agent-paths.ts";
import { resolveAgentGlobalConfigPath } from "pi-mcp-adapter/interfaces/agent-paths.ts";

// 1. Implement AgentAPI (8 required methods)
class MyAgentAdapter implements AgentAPI {
  private tools = new Map<string, ToolRegistration>();
  private flags = new Map<string, FlagConfig & { value?: string }>();
  private handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();

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

  registerTool(tool: ToolRegistration) { this.tools.set(tool.name, tool); }
  registerCommand(name: string, config: CommandConfig) { /* store or delegate */ }
  registerFlag(name: string, config: FlagConfig) { this.flags.set(name, { ...config }); }

  on(event: string, handler: (...args: unknown[]) => void | Promise<void>) {
    let set = this.handlers.get(event);
    if (!set) { set = new Set(); this.handlers.set(event, set); }
    set.add(handler as (...args: unknown[]) => unknown);
  }

  getAllTools(): ToolInfo[] {
    return [...this.tools.values()].map(t => ({ name: t.name }));
  }

  getFlag(name: string): string | undefined {
    const entry = this.flags.get(name);
    return entry ? entry.value : undefined;
  }

  sendMessage(message: unknown) { /* delegate to agent's messaging */ }

  async exec(command: string, args: string[]): Promise<unknown> {
    const cp = await import("node:child_process");
    return await new Promise((resolve, reject) => {
      const child = cp.spawn(command, args, { stdio: "pipe" });
      let stdout = "", stderr = "";
      child.stdout.on("data", (d) => stdout += d);
      child.stderr.on("data", (d) => stderr += d);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
      child.on("error", reject);
    });
  }

  // Companion: fire session events (for agents without native lifecycle)
  async fireSessionStart(ctx: AgentContext) {
    const handlers = this.handlers.get("session_start");
    if (handlers) for (const h of handlers) await h(ctx);
  }

  async fireSessionShutdown() {
    const handlers = this.handlers.get("session_shutdown");
    if (handlers) for (const h of handlers) await h();
  }
}

// 2. Provide path resolver
const resolver: AgentPathResolver = {
  agentId: "my-agent",
  globalConfigPath: () => {
    const configured = process.env.MCP_AGENT_DIR?.trim();
    if (!configured) return resolveAgentGlobalConfigPath(undefined, "");
    return resolveAgentGlobalConfigPath(undefined, configured);
  },
  projectConfigName: () => ".mcp.json",
};

// 3. Wire through createMcpAdapter
const adapter = new MyAgentAdapter();
const ctx: AgentContext = {
  cwd: process.cwd(),
  hasUI: false,
};
const config = loadMcpConfig(resolver.globalConfigPath());

createMcpAdapter(adapter, ctx, config, null);
await adapter.fireSessionStart(ctx);

// Verify
const tools = adapter.getAllTools();
console.log("Registered tools:", tools.map(t => t.name));
// Must include: "mcp"
```

### Registration Flow Summary

```
1. new MyAgentAdapter()          → create adapter instance
2. adaptContext({cwd, hasUI})    → build AgentContext
3. loadMcpConfig(path)           → load mcp.json
4. createMcpAdapter(adapter, ctx, config, cache)
   ├── adapter.registerFlag("mcp-config", ...)
   ├── adapter.registerCommand("mcp", ...)
   ├── adapter.registerCommand("mcp-auth", ...)
   ├── adapter.registerTool({name: "mcp", ...})  ← proxy tool
   └── adapter.on("session_start", handler)  ← lazy init
5. adapter.fireSessionStart(ctx) → triggers lazy server connections
6. Target agent is ready — LLM sees only 1 `mcp` tool (~250 tokens)
```

---

## npm Package Reference

| Field | Value |
|-------|-------|
| Package name | `pi-mcp-adapter` (historical name, code is universal) |
| Version | `2.10.0` |
| License | MIT |
| Universal entry | `createMcpAdapter(adapter, ctx, config, cache)` from `adapters/entry.ts` |
| Universal channel | `AgentChannel` from `interfaces/agent-channel.ts` — `attachChannel()` / `detachChannel()` |
| Bin: `pi-mcp-adapter` | CLI for `init` command — detects host configs |
| Bin: `mcp-server` | Universal MCP stdio server — register in agent's `.mcp.json` |

**No hard agent dependencies** — Pi SDK is optional peer dep.

### AgentChannel pattern

All adapters provide `attachChannel(channel)` / `detachChannel()` as companion methods
for bidirectional communication. The host wraps SDK-specific session handles into a
universal `AgentChannel`:

```typescript
import type { AgentChannel } from "pi-mcp-adapter/interfaces/agent-channel.ts";

// Stdio (universal): route to stderr for diagnostics
const channel: AgentChannel = {
  send: (msg) => console.error(`[adapter] ${JSON.stringify(msg)}`),
  close: () => {},
};
adapter.attachChannel(channel);
```

Legacy companion methods (`attachQuery`, `attachSendMessage`) remain for backward compatibility.
