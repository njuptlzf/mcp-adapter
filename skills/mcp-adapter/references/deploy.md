# Phase 2 Reference: Deploy Adapter

> **Called from**: `skills/mcp-adapter/SKILL.md` Phase 2
> **Path resolution**: See [resolver.md](resolver.md) — universal config path discovery

Deploys mcp-adapter into the target agent's runtime. This skill runs INSIDE the deployer
agent; the target agent is the recipient.

## Prerequisites

- Phase 0 complete (target agent identified, MCP compatibility confirmed)
- Phase 1 complete (mcp.json exists at the discovered config path)
- Target agent CLI/SDK available on the deployer's machine

## Deployment: Universal MCP (MCP stdio server)

### Step 1: Ensure mcp-server is available

```bash
# Check if mcp-server is in PATH
which mcp-server

# If not installed globally, install the package
npm install -g pi-mcp-adapter
```

### Step 2: Register in target agent's MCP config

The mcp.json was already generated in Phase 1. Verify the `mcp-adapter` entry exists:

```json
{
  "mcpServers": {
    "mcp-adapter": {
      "command": "mcp-server"
    }
  }
}
```

> The `mcp-server` bin entry is agent-agnostic. It speaks MCP protocol and
> discovers client capabilities at runtime via `server.getClientCapabilities()`.
> No agent-specific configuration is needed.

### Step 3: Restart target agent

The MCP client auto-discovers the server via stdio. The `mcp` proxy tool is now
available in every session.

### What the adapter provides

The adapter is a **complete implementation** within the MCP protocol's scope:

- ✅ `mcp` proxy tool (~200 tokens) — always available
- ✅ Sampling — forwarded via MCP `sampling/createMessage` reverse call when the
  agent declares `sampling` capability
- ✅ Elicitation — forwarded via MCP `elicitation/create` reverse call when the
  agent declares `elicitation.form` capability
- ✅ Status and panel — via tool actions (`executeStatus`) and content blocks

### Config path discovery

The `mcp-server` discovers config using the universal chain:

1. `--config` flag (highest precedence)
2. `MCP_CONFIG_PATH` environment variable
3. `.mcp.json` in current working directory
4. `~/.config/mcp/mcp.json` (shared global, lowest precedence)

---

## Verification

After deployment, verify with:

```bash
npm run verify:deploy -- --agent universal-mcp
```

Or run Phase 3 of the main skill for full integration testing.

## Common Issues

| Problem | Solution |
|---------|---------|
| "mcp tool not found" | Restart target agent; ensure `mcp-server` is registered in mcpServers config |
| "No servers connected" | Check mcp.json path; servers are lazy — call `mcp({ connect: "name" })` |
| "TypeScript import errors" | Verify `pi-mcp-adapter` installed; check tsconfig `moduleResolution` |
| "mcp-server not in PATH" | `npm install -g pi-mcp-adapter` to install the bin globally |
