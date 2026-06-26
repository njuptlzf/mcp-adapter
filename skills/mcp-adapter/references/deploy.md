# Phase 2 Reference: Deploy Adapter

> **Called from**: `skills/mcp-adapter/SKILL.md` Phase 2
> **Migrated from**: `skills/deploy-mcp-adapter/SKILL.md` (deprecated)
> **Path resolution**: See [resolver.md](resolver.md) — use `AGENT_ADAPTERS[i].resolverFactory()`

Deploys mcp-adapter into the target agent's runtime. This skill runs INSIDE the deployer
agent; the target agent is the recipient.

## Prerequisites

- Phase 1 complete (mcp.json exists at the target agent's config path)
- Target agent CLI/SDK available on the deployer's machine

## Branch Decision

From `AGENT_ADAPTERS` and `package.json` bin patterns:

| Entry point | Branch | Agent |
|-------------|--------|-------|
| `pi.extensions: ["./index.ts"]` | Branch A | Pi |
| `bin["<id>-mcp-bridge"]` | Branch B | Qoder |
| `bin["<id>-mcp-server"]` | Branch C / Strategy A | Kilo |
| Not in registry | Branch C (custom) | (new agent) |

---

## Branch A: Pi (Native Extension)

```bash
pi install npm:pi-mcp-adapter
# Restart Pi — mcp proxy tool, /mcp command, /mcp-auth command available
```

---

## Branch B: Qoder (SDK Bridge)

### Step B1: Install packages

```bash
npm install pi-mcp-adapter @qoder-ai/qoder-agent-sdk
```

### Step B2: Create integration entry point

File: `{globalConfigPath}/qoder-mcp-adapter-entry.ts` (resolve via `createQoderResolver().globalConfigPath()`)

See [deploy-examples.md](deploy-examples.md#qoder-integration-entry-point) for the complete template:
1. Create `QoderAdapter` + `AgentContext`
2. Load config via resolver
3. Call `createMcpAdapter(adapter, ctx, config, cache)`
4. Bridge tools to Qoder SDK via `createSdkMcpServer` + `query()`
5. Fire `fireSessionStart(ctx)`

### Step B3: Register SessionStart hook

In `~/.qoder/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "npx tsx ~/.qoder/agent/qoder-mcp-adapter-entry.ts"
      }]
    }]
  }
}
```

---

## Branch C / Strategy A: Kilo (MCP stdio server)

### Step C1: Register in agent's MCP config

In the target agent's mcpServers config (e.g. `~/.kilo/mcp.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "mcp-adapter": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-adapter/bin/kilo-mcp-server.ts"]
    }
  }
}
```

### Step C2: Restart agent

The MCP client auto-discovers the server via stdio. The `mcp` proxy tool,
`/mcp` command, and `/mcp-auth` command are now available in every session.

---

## Branch C: Custom Agent

For agents not in `AGENT_ADAPTERS`:

### Step C1: Implement AgentAPI

8 required methods. Full guide: [deploy-examples.md](deploy-examples.md#branch-c-custom-agent)

### Step C2: Provide AgentPathResolver

Returns agent's config paths.

### Step C3: Wire through createMcpAdapter

Same universal flow. See [deploy-examples.md](deploy-examples.md#branch-c-custom-agent)

### Step C4: Inject into agent startup

Decision tree:

```
Agent has native hooks/plugins?
  ├─ YES → Use agent's own lifecycle API
  │   E.g. Qoder SessionStart, Cursor hooks, VS Code activate()
  └─ NO → Agent supports MCP natively?
        ├─ YES → Strategy A: MCP stdio server
        └─ NO → Can wrap launch command?
              ├─ YES → Strategy B: Wrapper script
              └─ NO → Strategy C: NODE_OPTIONS injection
                    └─ NO → Manual: user runs entry before starting agent
```

---

## Verification

After deployment, verify with:

```bash
npm run verify:deploy -- --agent <id>
```

Or run Phase 3 of the main skill for full integration testing.

## Common Issues

| Problem | Solution |
|---------|----------|
| "mcp tool not found" | Restart target agent; ensure entry script ran before session start |
| "No servers connected" | Check mcp.json path; servers are lazy — call `mcp({ connect: "name" })` |
| "Agent SDK not found" | Pi SDK: optional peer dep; Qoder SDK: regular dep; Custom: no SDK needed |
| "TypeScript import errors" | Verify `pi-mcp-adapter` installed; check tsconfig `moduleResolution` |
