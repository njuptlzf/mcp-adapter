# Deployment Code Examples

Complete code templates for Phase 2 deployment branches. These are referenced by SKILL.md and read only when needed.

## Qoder Integration Entry Point

Full integration code for deploying mcp-adapter into Qoder. This file should be created at a path that the Qoder host loads at session start (e.g. a plugin entry or startup hook).

```typescript
// qoder-mcp-adapter-entry.ts
import { createMcpAdapter } from "pi-mcp-adapter/adapters/entry.ts";
import { QoderAdapter, adaptQoderContext } from "pi-mcp-adapter/adapters/qoder-adapter.ts";
import { createQoderResolver } from "pi-mcp-adapter/interfaces/agent-paths.ts";
import { loadMcpConfig } from "pi-mcp-adapter/config.ts";
import { loadMetadataCache } from "pi-mcp-adapter/metadata-cache.ts";
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
adapter.attachQuery(q);

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

## Custom Agent Integration

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
| Bin | `pi-mcp-adapter` (CLI for `init` command — detects host configs) |

**No hard agent dependencies** — Pi SDK is optional peer dep, Qoder SDK is regular dep but only loaded when `QoderAdapter` is imported.
