# Deployment Code Examples

Complete code templates for Phase 2 deployment branches. These are referenced by SKILL.md and read only when needed.

> **How this file is routed from Phase 0**
>
> SKILL.md Phase 0.2 maps each registered adapter (`AGENT_ADAPTERS`) to a deployment branch by inspecting `package.json` (`bin`, `pi.extensions`) and `bin/`. This file is organized by entry-point pattern — pick the section that matches the Phase 0.2 verdict for the chosen agent:
>
> | Section | Entry-point pattern | Example agent |
> | ------- | ------------------- | ------------- |
> | [Branch A: Pi native install](#branch-a-pi-native-install) | `pi.extensions: ["./index.ts"]` | Pi |
> | [Branch B: SDK bridge + SessionStart hook](#branch-b-sdk-bridge--sessionstart-hook) | `bin["<id>-mcp-bridge"]` | Qoder |
> | [Branch C / Strategy A: MCP stdio server](#branch-c--strategy-a-mcp-stdio-server) | `bin["<id>-mcp-server"]` | Kilo |
> | [Branch C: Custom Agent](#branch-c-custom-agent) | Not in `AGENT_ADAPTERS` | (any new agent) |
>
> When a new adapter is registered, this file does **not** need to be edited — the new section lives in `bin/<id>-mcp-<role>.ts` and `AGENT_ADAPTERS` is the index.

---

## Branch A: Pi native install

Pi ships a native extension API. The `pi-mcp-adapter` package itself is the install target — no separate entry script needed. After `pi install npm:pi-mcp-adapter`, Pi loads `index.ts` (the `pi.extensions` entry in `package.json`) on every session.

```bash
pi install npm:pi-mcp-adapter
# Restart Pi — the `mcp` proxy tool, `/mcp` command, and `/mcp-auth` command are now available.
```

No per-agent code template is needed for Branch A; the entry point lives in [`index.ts`](../../index.ts) of this repo.

---

## Branch B: SDK bridge + SessionStart hook

> **Routed here when** `package.json` has `bin["<id>-mcp-bridge"]` (e.g. `qoder-mcp-bridge`).
> The Qoder template below is the reference example; copy and adapt for any new SDK-bridge adapter.

### Qoder Integration Entry Point

Full integration code for deploying mcp-adapter into Qoder. This file should be created at a path that the Qoder host loads at session start (e.g. a plugin entry or startup hook).

```typescript
// qoder-mcp-adapter-entry.ts
import { createMcpAdapter } from "pi-mcp-adapter/adapters/entry.ts";
import { QoderAdapter, adaptQoderContext } from "pi-mcp-adapter/adapters/qoder-adapter.ts";
import { createQoderResolver } from "pi-mcp-adapter/interfaces/agent-paths.ts";
import { loadMcpConfig } from "pi-mcp-adapter/config.ts";
import { loadMetadataCache } from "pi-mcp-adapter/metadata-cache.ts";
import type { AgentChannel } from "pi-mcp-adapter/interfaces/agent-channel.ts";
import { createSdkMcpServer, query } from "@qoder-ai/qoder-agent-sdk";

// 1. Create adapter instance + context
const adapter = new QoderAdapter();
const ctx = adaptQoderContext(
  { cwd: process.cwd(), hasUI: true },
  adapter,
);

// 2. Load config from Qoder's global config path
const resolver = createQoderResolver();
const config = loadMcpConfig(resolver.globalConfigPath());
const cache = loadMetadataCache();

// 3. Register everything (proxy tool, commands, flags, lifecycle)
createMcpAdapter(adapter, ctx, config, cache);

// 4. Bridge adapter tools to Qoder SDK
const tools = [...adapter.tools.values()];
const mcpServer = createSdkMcpServer({ name: "mcp-adapter-tools", tools });
const q = query({
  prompt: "",
  options: {
    mcpServers: { "mcp-adapter-tools": mcpServer },
    allowedTools: tools.map(t => `mcp__mcp-adapter-tools__${t.name}`),
  },
});

// 4b. Wrap the Query handle into a universal AgentChannel
// The channel normalizes the adapter → session communication path.
// sendMessage routes through q.streamInput(); close delegates to q.close().
const channel: AgentChannel = {
  send: (message: unknown) => {
    void q.streamInput(
      (async function* () { yield message; })(),
    );
  },
  close: () => { void q.close(); },
};
adapter.attachChannel(channel);

// 5. Fire session_start → triggers lazy server connections
await adapter.fireSessionStart(ctx);

// Verify
const registeredTools = adapter.getAllTools();
console.log("Registered tools:", registeredTools.map(t => t.name));
// Must include: "mcp"
```

### Qoder Config Path Resolution

| Scope | Path | Notes |
|-------|------|-------|
| Agent global | `~/.qoder/agent/mcp.json` | Qoder-specific global config |
| Shared global | `~/.config/mcp/mcp.json` | Works across all agents |
| Shared project | `.mcp.json` | Current project root |

Override: `MCP_AGENT_DIR=/custom/path`

### Qoder UI Capabilities

Qoder's `UISystem` is intentionally minimal (notify-only):

| Method | Available | Implementation |
|--------|-----------|----------------|
| `notify` | Yes | `console.log/warn/error` with `[mcp-adapter/qoder]` prefix |
| `setStatus` | No | `undefined` |
| `form` | No | `undefined` |
| `custom` | No | `undefined` |
| `theme` | No | `undefined` |

### Qoder SessionStart Hook Registration

Qoder guarantees startup injection via its hooks system. Add a `SessionStart` hook to `~/.qoder/settings.json` that runs the integration entry point on every new session:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx tsx ~/.qoder/agent/qoder-mcp-adapter-entry.ts"
          }
        ]
      }
    ]
  }
}
```

This is the Qoder equivalent of Pi's `ExtensionAPI` lifecycle: it guarantees code execution at session boundary. Without it, `QoderAdapter.tools` stays locked in private Maps and Qoder never sees the `mcp` proxy tool.

---

## Branch C / Strategy A: MCP stdio server

> **Routed here when** `package.json` has `bin["<id>-mcp-server"]` (e.g. `kilo-mcp-server`).
> The Kilo template below is the reference example; copy and adapt for any new agent that natively speaks MCP.

For agents that have a native MCP client but no extension/hook system, the most portable strategy is to expose mcp-adapter as an MCP stdio server. The target agent's `mcpServers` config picks it up automatically.

### Kilo Integration (reference template)

The `kilo-mcp-server` bin lives at [`bin/kilo-mcp-server.ts`](../../bin/kilo-mcp-server.ts) in this repo — it is the canonical Branch C / Strategy A implementation. To deploy:

**Step 1:** Install the package.

```bash
npm install pi-mcp-adapter
# or globally: npm install -g pi-mcp-adapter
```

**Step 2:** Register the server in Kilo's MCP config (`kilo.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "mcp-adapter": {
      "command": "kilo-mcp-server"
    }
  }
}
```

**Step 3:** Restart Kilo. The MCP client auto-discovers the server via stdio. The `mcp` proxy tool, `/mcp` command, and `/mcp-auth` command are now available in every session.

**How it works internally** (from [`bin/kilo-mcp-server.ts`](../../bin/kilo-mcp-server.ts)):

```typescript
// 1. Load mcp.json config
const config = loadMcpConfig(); // auto-discovers .mcp.json or ~/.config/mcp/mcp.json

// 2. Create the universal adapter (Kilo is a generic AgentAPI implementation)
const adapter = new KiloAdapter();
const ctx: AgentContext = adaptKiloContext({ cwd: process.cwd(), hasUI: false });
const cache = loadMetadataCache();

// 3. Register everything via the universal entry point
createMcpAdapter(adapter, ctx, config, cache);

// 4. Attach an AgentChannel — routes adapter sendMessage to stderr
const channel: AgentChannel = {
  send: (msg) => console.error(`[kilo-mcp-server] ${JSON.stringify(msg)}`),
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
  { name: "mcp-adapter-kilo", version: "2.9.0" },
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

### Kilo Config Path Resolution

| Scope | Path | Notes |
|-------|------|-------|
| Agent global | `~/.kilo/mcp.json` | Kilo-specific global config |
| Shared global | `~/.config/mcp/mcp.json` | Works across all agents |
| Shared project | `.mcp.json` | Current project root |

Override: `MCP_AGENT_DIR=/custom/path`

---

## Branch C: Custom Agent

> **Routed here when** the chosen agent is **not** in `AGENT_ADAPTERS`. This is the only branch that requires writing new code (the AgentAPI implementation) before deployment.

Template for agents not yet in `AGENT_ADAPTERS` (Claude, Cursor, Windsurf, etc.).

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
| Version | `2.9.0` |
| License | MIT |
| Universal entry | `createMcpAdapter(adapter, ctx, config, cache)` from `adapters/entry.ts` |
| Universal channel | `AgentChannel` from `interfaces/agent-channel.ts` — `attachChannel()` / `detachChannel()` |
| Bin: `pi-mcp-adapter` | CLI for `init` command — detects host configs |
| Bin: `kilo-mcp-server` | Kilo MCP stdio server — register in `.mcp.json` |
| Bin: `qoder-mcp-bridge` | Qoder SDK bridge — register in `~/.qoder/settings.json` SessionStart hook |

**No hard agent dependencies** — Pi SDK is optional peer dep, Qoder SDK is regular dep but only loaded when `QoderAdapter` is imported.

### AgentChannel pattern

All adapters provide `attachChannel(channel)` / `detachChannel()` as companion methods for bidirectional communication. The host wraps SDK-specific session handles into a universal `AgentChannel`:

```typescript
import type { AgentChannel } from "pi-mcp-adapter/interfaces/agent-channel.ts";

// Qoder: wrap Query handle
const channel: AgentChannel = {
  send: (msg) => q.streamInput((async function*() { yield msg; })()),
  close: () => q.close(),
};
adapter.attachChannel(channel);

// Kilo (stdio): route to stderr for diagnostics
const channel: AgentChannel = {
  send: (msg) => console.error(`[adapter] ${JSON.stringify(msg)}`),
};
adapter.attachChannel(channel);

// Pi: no-op (native ExtensionAPI channel already works)
// attachChannel is optional for Pi
```

Legacy companion methods (`attachQuery`, `attachSendMessage`) remain for backward compatibility.
