# Phase 2 Reference: Deploy Adapter

> **Called from**: `skills/mcp-adapter/SKILL.md` Phase 2
> **Path resolution**: See [resolver.md](resolver.md) — universal config path discovery (D-02)

Deploys mcp-adapter into the target agent's runtime. This skill runs INSIDE the deployer
agent; the target agent is the recipient.

## Prerequisites

- Phase 1 complete (mcp.json exists at a discoverable config path)
- Target agent CLI/SDK available on the deployer's machine

## Branch Decision

Phase 0 determines the branch — there is no package.json inspection needed (D-12):

| User answers | Branch | Agent |
|--------------|--------|-------|
| "Pi" | Branch A | Pi (native extension) |
| "Other MCP-compatible agent" | Branch C | Any MCP-compatible agent |

> The legacy SDK bridge approach was removed in Phase 12 and is no longer documented.

---

## Branch A: Pi (Native Extension)

```bash
pi install npm:pi-mcp-adapter
# Restart Pi — mcp proxy tool, /mcp command, /mcp-auth command available
```

Branch A provides:
- Full TUI panel (`/mcp`, `/mcp setup`, `/mcp tools`, `/mcp reconnect`)
- Custom renderers (ANSI TUI rendering)
- In-process sampling via `PiSamplingProvider`
- Elicitation forms and URL prompts

---

## Branch C: Universal MCP (MCP stdio server)

### Step C1: Register in agent's MCP config

In the target agent's `mcpServers` config (project `.mcp.json` or global
`~/.config/mcp/mcp.json`):

```json
{
  "mcpServers": {
    "mcp-adapter": {
      "command": "mcp-server"
    }
  }
}
```

> The `mcp-server` bin entry is agent-agnostic (D-05). It speaks MCP protocol and
> discovers client capabilities at runtime via `server.getClientCapabilities()`.
> No agent-specific configuration is needed.

### Step C2: Restart agent

The MCP client auto-discovers the server via stdio. The `mcp` proxy tool is now
available in every session.

### What Branch C provides (D-08)

Branch C is a **complete implementation** within the MCP protocol's scope:

- ✅ `mcp` proxy tool (~200 tokens) — always available
- ✅ Sampling — forwarded via MCP `sampling/createMessage` reverse call when the
  agent declares `sampling` capability (pure forwarding, D-11)
- ✅ Elicitation — forwarded via MCP `elicitation/create` reverse call when the
  agent declares `elicitation.form` capability (pure forwarding, D-11)
- ✅ Status and panel — via tool actions (`executeStatus`) and content blocks

What Pi Branch A provides extra is richer UI (TUI rendering with ANSI codes), which
is a **presentation enhancement**, not a capability difference (D-08).

### Config path discovery (D-02)

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
|---------|----------|
| "mcp tool not found" | Restart target agent; ensure `mcp-server` is registered in mcpServers config |
| "No servers connected" | Check mcp.json path; servers are lazy — call `mcp({ connect: "name" })` |
| "TypeScript import errors" | Verify `pi-mcp-adapter` installed; check tsconfig `moduleResolution` |
