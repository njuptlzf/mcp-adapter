---
name: deploy-mcp-adapter
description: Deploy mcp-adapter into a TARGET coding agent (not the current agent). Identifies the target agent by reading the `AGENT_ADAPTERS` registry in `interfaces/agent-api.ts` (single source of truth), then executes the appropriate deployment branch — per-adapter entry point (Pi native install, Kilo MCP stdio, Qoder SDK bridge, etc.) or a Custom Agent implementation flow. Result is a persistent integration where the target agent gets 1 `mcp` proxy tool (~250 tokens) instead of hundreds of tool definitions. Use when user says "部署mcp-adapter", "安装mcp-adapter", "deploy mcp-adapter", "install mcp-adapter", "接入新agent", "给X安装mcp-adapter", or when integrating mcp-adapter into any agent.
---

> ⚠️ **DEPRECATED** — 此 skill 已被 [`/mcp-adapter`](../mcp-adapter/SKILL.md) 统一入口取代。
> 功能已完整迁移至 `skills/mcp-adapter/SKILL.md`（Phase 2: Deploy Adapter）。
> 保留此文件仅用于向后兼容，新用户请使用 `/mcp-adapter`。

# Deploy MCP Adapter

Deploy mcp-adapter into a **target agent** so that agent gets a single `mcp` proxy tool (~250 tokens) instead of hundreds of MCP tool definitions. The current agent (you) is the deployer; the target agent is the recipient.

**Key principle**: This skill deploys INTO a target agent's persistent runtime — not a one-time script run in the current session.

## Workflow Checklist

Copy and track progress:

```
Deployment Progress:
- [ ] Phase 0: Identify target agent
- [ ] Phase 1: Verify prerequisites
- [ ] Phase 2: Execute deployment (branch by agent type)
- [ ] Phase 3: Verify persistent deployment
- [ ] Phase 4: Complete adapter registration (AGENT_ADAPTERS + agent-paths file)
```

---

## Phase 0: Identify Target Agent

**MUST complete before any other step.** Ask the user which agent to deploy mcp-adapter to.

**Single source of truth:** the `AGENT_ADAPTERS` array in [`interfaces/agent-api.ts`](../../interfaces/agent-api.ts). Every adapter registered there is already implemented and ready to deploy — do **not** hardcode an agent list here, do **not** trust older docs, the registry is the truth. The same pattern is reused by `mcp-adapter-test` (see its Step 5a).

### Step 0.1: Read the registry

```bash
# Show all currently registered adapters (one row per id+displayName)
grep -B1 -A5 "id:" interfaces/agent-api.ts | grep -E "(id:|displayName:)" | head -20
```

Or read `interfaces/agent-api.ts` directly and locate `export const AGENT_ADAPTERS: AgentAdapterDescriptor[]`. For each `descriptor` capture:

- `id` — stable identifier (e.g. `pi`, `kilo`, `qoder`)
- `displayName` — human-readable name
- `factory()` — confirms the adapter is implemented
- `resolverFactory` — which `AgentPathResolver` to use for path discovery
- `envHints` — env vars / files that indicate the adapter is loaded
- `capabilities.{ui, sampling, renderer}` — runtime surface

### Step 0.2: Map each adapter to a deployment branch

Inspect `package.json` (`bin` and `pi.extensions`) and the `bin/` directory to find the adapter's entry point:

| Entry point pattern                                                                 | Branch                  | Description                                                                          |
| ----------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `package.json` has `pi.extensions: ["./index.ts"]`                                  | Branch A (Pi native)    | `pi install npm:pi-mcp-adapter`                                                      |
| `package.json` has `bin["<id>-mcp-server"]` (e.g. `kilo-mcp-server`)                | Branch C / Strategy A   | MCP stdio server — register in target agent's `mcpServers` config                    |
| `package.json` has `bin["<id>-mcp-bridge"]` (e.g. `qoder-mcp-bridge`)                | Branch B (SDK bridge)   | SDK bridge + `SessionStart` hook injection                                            |
| Other / unknown                                                                     | Fallback to Branch C    | Inspect `bin/` for the adapter-specific entry; otherwise treat as Custom Agent        |

For per-adapter path / verification details, see `skills/mcp-adapter-test/references/agent-paths/<id>.md` (every registered adapter has one).

### Step 0.3: Build the option list

For each descriptor in `AGENT_ADAPTERS`, add an option to AskUserQuestion:

- **Label:** `displayName` (e.g. `Kilo`, `Pi`, `Qoder`)
- **Value:** `id` (e.g. `kilo`, `pi`, `qoder`)
- **Description:** short summary derived from Step 0.2's branch mapping

Always append the final option:

- **Label:** `Custom Agent`
- **Value:** `__custom__`
- **Description:** `Not in AGENT_ADAPTERS — requires implementing AgentAPI (8 methods) first`

**Record the answer.** All subsequent phases branch on this decision. If the user names an agent literally (e.g. "给 qodercli 安装", "deploy to Pi"), look up the matching `id` in `AGENT_ADAPTERS` to map it.

---

## Phase 1: Verify Prerequisites

### 1.1 Check mcp.json exists

The target agent needs an mcp.json config file. Discover the path dynamically — do **not** hardcode paths per agent. For the chosen `id` from Phase 0, resolve via its `resolverFactory` and check these paths in priority order:

| Scope        | How to resolve                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent global | Call `AGENT_ADAPTERS.find(d => d.id === <id>).resolverFactory().globalConfigPath()` and read `<that path>/mcp.json`                                              |
| Shared global | `~/.config/mcp/mcp.json` (works for any agent)                                                                                                                   |
| Project      | `.mcp.json` in cwd (works for any agent)                                                                                                                          |
| Override     | `MCP_AGENT_DIR=/custom/path` env var                                                                                                                              |

Reference: per-adapter `globalConfigPath` defaults are documented in `skills/mcp-adapter-test/references/agent-paths/<id>.md`.

- If NO mcp.json found → **Stop**. Tell the user to run the `generate-mcp-config` skill first, then return here.
- If mcp.json found → Record the path and server count, continue.

### 1.2 Check target agent availability

For the chosen `id`, derive the readiness check from the adapter's `envHints` (read from `AGENT_ADAPTERS` in Phase 0.1) and the `bin/` entry point pattern (Phase 0.2):

- **Native CLI command**: if the agent ships a CLI (e.g. `pi`, `kilo`, `qodercli`), check that command exists on `PATH` (`command -v <cli>` or `which <cli>`).
- **SDK package**: if deployment requires an SDK (e.g. `@qoder-ai/qoder-agent-sdk` for Qoder), check it is installed in the target project (`ls node_modules/<sdk-package>` or `npm ls <sdk-package>`).
- **Custom Agent**: check the target agent's runtime / binary is available — ask the user if unclear.

If the target agent is not available → **Stop**. Tell the user the target agent must be installed first.

---

## Phase 2: Execute Deployment

Branch based on the target agent from Phase 0.

### Branch A: Pi

Pi has native extension support — deployment is one command:

```bash
pi install npm:pi-mcp-adapter
```

After install, the user must **restart Pi**. The `mcp` proxy tool, `/mcp` command, and `/mcp-auth` command will be available in all new Pi sessions.

Go to Phase 3.

### Branch B: Qoder

Qoder requires SDK bridge integration. Unlike Pi's native `ExtensionAPI`, the `QoderAdapter` stores tools in internal Maps — a startup script must explicitly bridge them into Qoder's SDK via `createSdkMcpServer` + `query()` on every session.

**Step B1: Install packages** (in the target project or globally):

```bash
npm install pi-mcp-adapter @qoder-ai/qoder-agent-sdk
```

**Step B2: Create the integration entry point** — a standalone script placed under Qoder's global agent directory (determined by `AgentPathResolver`, default `~/.qoder/agent/`).

File location: `{globalConfigPath}/qoder-mcp-adapter-entry.ts` (use `createQoderResolver().globalConfigPath()` to resolve the path).

See [references/deploy-examples.md](references/deploy-examples.md#qoder-integration-entry-point) for the complete code template. The script does:
1. Create `QoderAdapter` instance + `AgentContext`
2. Load mcp.json config via `createQoderResolver().globalConfigPath()`
3. Call `createMcpAdapter(adapter, ctx, config, cache)`
4. Bridge tools to Qoder SDK via `createSdkMcpServer` + `query`
5. Fire `fireSessionStart(ctx)` → triggers lazy MCP server connections

**Step B3: Register via SessionStart hook** — Qoder guarantees startup injection through its hooks system in `settings.json` (`~/.qoder/settings.json`). Add a `SessionStart` hook that runs the entry point before each session:

```json
// in ~/.qoder/settings.json → hooks.SessionStart[]
{
  "hooks": [
    {
      "type": "command",
      "command": "npx tsx ~/.qoder/agent/qoder-mcp-adapter-entry.ts"
    }
  ]
}
```

The hook fires **every new session** — the entry script re-runs, re-registers the `mcp` proxy tool, and re-connects MCP servers (lazy).

> **Why hooks?** Qoder's `SessionStart` hook is the equivalent of Pi's `ExtensionAPI` lifecycle: it guarantees code execution at session boundary. Without it, `QoderAdapter.tools` stays in private Maps and Qoder never sees them.

Go to Phase 3.

### Branch C: Custom Agent (Claude, Cursor, Windsurf, etc.)

For agents not yet in `AGENT_ADAPTERS`:

**Step C1: Implement `AgentAPI`** — 8 required methods. Full guide: [references/adapter-implementation.md](references/adapter-implementation.md)

**Step C2: Provide `AgentPathResolver`** — returns the target agent's config paths.

**Step C3: Wire through `createMcpAdapter`** — same universal flow as Branch B. See [references/deploy-examples.md](references/deploy-examples.md#custom-agent-integration) for the complete code template.

**Step C4: Inject into the target agent's startup** — choose the strategy that matches the agent's capabilities. If the agent has no hook/plugin system, fall back to one of the MCP-level strategies below.

**Decision tree** (pick the first that applies):

```
Agent has native hooks/plugins?
  ├─ YES → Use the agent's own lifecycle API
  │   Examples: Qoder SessionStart hook, Cursor hooks, VS Code extension activate()
  │
  └─ NO → Does the agent support MCP natively (mcp.json / .cursor/mcp.json)?
        ├─ YES → Strategy A: MCP stdio server (recommended)
        │   Register mcp-adapter as an MCP server; agent auto-connects at startup.
        │
        └─ NO → Can you wrap the agent's launch command?
              ├─ YES → Strategy B: Wrapper script
              │   Shell script that runs entry point first, then launches agent.
              │
              └─ NO → Is the agent Node.js-based?
                    ├─ YES → Strategy C: NODE_OPTIONS injection
                    │   node --require ./mcp-adapter-entry.ts the-agent
                    │
                    └─ NO → Manual: user must run entry script before starting agent
```

**Strategy A: MCP stdio server** (most portable)

Convert the entry point into an MCP-compatible server process. The agent's native MCP client handles connection/discovery automatically:

```json
// Agent's mcp.json / .cursor/mcp.json / claude_desktop_config.json
{
  "mcpServers": {
    "mcp-adapter": {
      "command": "npx",
      "args": ["tsx", "{agentConfigPath}/mcp-adapter-entry.ts"]
    }
  }
}
```

No hooks, no code changes to the agent. Just MCP config.

**Strategy B: Wrapper script**

```bash
#!/bin/bash
# ~/.local/bin/my-agent-with-mcp
npx tsx ~/.my-agent/mcp-adapter-entry.ts &
sleep 2  # wait for registration
my-agent "$@"
```

**Strategy C: NODE_OPTIONS**

```bash
NODE_OPTIONS="--require ./mcp-adapter-entry.ts" my-agent
```

After injection: Go to Phase 3.

---

## Phase 3: Verify Persistent Deployment

Verification must confirm the target agent (not the current agent) has the `mcp` proxy tool. Use a single universal check that works for every adapter registered in `AGENT_ADAPTERS`:

```typescript
// Universal verification — works for any adapter that exposes AgentAPI
import { AGENT_ADAPTERS } from "../../interfaces/agent-api.ts";
import { createMcpAdapter } from "../../adapters/entry.ts";
import { loadMcpConfig } from "../../config.ts";

const descriptor = AGENT_ADAPTERS.find(d => d.id === <chosenId>);
const adapter = descriptor.factory();
const ctx = { cwd: process.cwd(), hasUI: descriptor.capabilities?.ui ?? false };
const config = loadMcpConfig();
createMcpAdapter(adapter, ctx, config, null);

// Universal signal: the `mcp` proxy tool must be registered.
const tools = adapter.getAllTools();
console.assert(tools.some(t => t.name === "mcp"), "mcp proxy tool not registered");
```

### Per-adapter verification steps

The above universal check passes for every registered adapter. For **runtime** confirmation in the target agent, follow the per-adapter recipe in `skills/mcp-adapter-test/references/agent-paths/<id>.md`. The general pattern:

1. **Restart / spawn a new session** of the target agent so the entry point re-runs.
2. **List registered tools** and confirm `mcp` is present (the agent-specific UI / CLI command varies; see `agent-paths/<id>.md`).
3. **Call `mcp({})`** to get the server status panel — proves the tool is wired end-to-end.
4. **Check `/mcp` slash command** (for agents with a CLI; not all agents expose this).

### Verification Checklist
- [ ] Target agent starts without errors
- [ ] `mcp` proxy tool is registered in the target agent
- [ ] `/mcp` command available (for agents with CLI)
- [ ] mcp.json config is loaded (server count > 0)
- [ ] Proxy tool call `mcp({})` returns server status

If any check fails → see Common Issues below.

---

## Phase 4: Complete Adapter Registration

After implementing and testing the adapter, complete the registration in two places.

### 4.1 Register in `AGENT_ADAPTERS`

Add the adapter descriptor to `interfaces/agent-api.ts`:

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

This makes the adapter visible to the `mcp-adapter-test` skill and compatibility matrix.

### 4.2 Create agent-paths test reference (REQUIRED)

**Every adapter in `AGENT_ADAPTERS` MUST have a corresponding `skills/mcp-adapter-test/references/agent-paths/<id>.md` file.** This file tells the test runner how to verify the adapter in each deployment path (Path A proxy / Path B directTools / Path C SDK_DIRECT).

```bash
# Copy the template and fill in your adapter's specifics
cp skills/mcp-adapter-test/references/agent-paths/_template.md \
   skills/mcp-adapter-test/references/agent-paths/<your-agent-id>.md
```

Fill in for your adapter:
- **Path A verification**: How to confirm the `mcp` proxy tool is registered and working
- **Path B verification**: How to confirm directTools mode is active (tool naming prefix, individual calls)
- **Path C fallback**: Any agent-specific notes for SDK_DIRECT mode
- **Agent-specific notes**: Default config path, UI capabilities (`notify`/`form`/`setStatus`/`theme`), env vars that activate this adapter, companion methods (e.g. `attachChannel` / `detachChannel`; legacy aliases: `attachQuery`, `attachSendMessage`)

See existing examples: [pi.md](../../mcp-adapter-test/references/agent-paths/pi.md), [qoder.md](../../mcp-adapter-test/references/agent-paths/qoder.md).

> ⚠️ **Without this file, the `mcp-adapter-test` skill cannot run Path-specific verification (Phase 4 Step 1) for the new adapter.** The Capability Gate and contract tests will still pass, but per-agent deployment-path verification will be skipped.

### 4.3 Verify completeness

Run the mcp-adapter-test skill's pre-flight to confirm all adapters have agent-paths files:

```bash
# Checks that every AGENT_ADAPTERS entry has a matching agent-paths/<id>.md
ls skills/mcp-adapter-test/references/agent-paths/*.md
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "mcp tool not found" | Ensure `createMcpAdapter()` ran before session start; call `fireSessionStart()` for agents without native lifecycle; restart the target agent |
| "No servers connected" | Check mcp.json at correct path; servers are lazy — call `mcp({ connect: "server-name" })`; run `mcp({})` for status |
| "TypeScript import errors" | Verify `pi-mcp-adapter` installed; check tsconfig `moduleResolution` is `"bundler"` or `"node16"`; import paths use `.ts` extensions |
| "Agent SDK not found" | Pi SDK: optional peer dep for PiAdapter only; Qoder SDK: regular dep; Custom agents: no SDK needed |

---

## What the Target Agent Gets After Deployment

- **1 `mcp` proxy tool** (~250 tokens) instead of per-tool definitions
- **Lazy server connections** — servers start on first tool call, not at startup
- **Cached tool metadata** — search/describe work without live connections
- **Idle auto-disconnect** — servers disconnect after 10 min (configurable)
- **Direct tool promotion** — specific tools can be promoted to first-class via `directTools` config
- **OAuth/Bearer auth** — automatic auth flow for secured MCP servers
- **Token savings** — ~94% reduction in tool definition tokens (10-server scenario)

## References

- [references/adapter-implementation.md](references/adapter-implementation.md) — AgentAPI interface: 8-method contract, UISystem, AgentContext, session lifecycle
- [references/deploy-examples.md](references/deploy-examples.md) — Complete code templates for Qoder and custom agent deployment
