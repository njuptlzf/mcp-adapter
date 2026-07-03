# Agent Resolver Reference

Universal path resolution and agent discovery for mcp-adapter deployment.

## Agent Discovery Protocol

When the user names a target agent in Phase 0, the host agent follows this protocol
to discover the agent's MCP config location and verify MCP compatibility:

### Step 1: Check known config paths

| Agent | Global Config Path | Project Config | Config Key |
|-------|-------------------|----------------|------------|
| Qoder | `~/.qoder/agent/mcp.json` | `.mcp.json` | `mcpServers` |
| Claude Code | `~/.claude/agent/mcp.json` | `.mcp.json` | `mcpServers` |
| Cursor | `~/.cursor/mcp.json` | `.mcp.json` | `mcpServers` |
| Kilo | `~/.kilo/mcp.json` | `.mcp.json` | `mcpServers` |
| (universal fallback) | `~/.config/mcp/mcp.json` | `.mcp.json` | `mcpServers` |

Override: `MCP_AGENT_DIR` env var for any agent.

### Step 2: Verify agent binary exists

```bash
which <agent-name> 2>/dev/null || which <agent-binary> 2>/dev/null
```

### Step 3: Verify MCP protocol support

- Look for `mcpServers` key in the agent's existing config file
- Check if the agent's config directory exists
- If no MCP support found → STOP and inform the user

### Step 4: Report findings

Present the discovered config path, binary location, and MCP compatibility status
to the user before proceeding to Phase 1.

## Config Path Resolution

The discovery chain is universal for all agents:

| Precedence | Source | Description |
|------------|--------|-------------|
| 1 (highest) | `--config` flag | Explicit path passed to `mcp-server` |
| 2 | `MCP_CONFIG_PATH` env var | Environment variable override |
| 3 | `.mcp.json` in cwd | Project-local shared config |
| 4 (lowest) | `~/.config/mcp/mcp.json` | User-global shared config |

### Using PATH-01 Self-Reporting

When an agent knows its config path at runtime, pass it via `AgentContext.mcpConfigPath`:

```typescript
const resolver = createUniversalResolver();
const ctx: AgentContext = {
  cwd: process.cwd(),
  hasUI: false,
  mcpConfigPath: resolver.globalConfigPath()  // PATH-01 self-reporting
};
// loadMcpConfig will use ctx.mcpConfigPath before falling back to DEFAULT_AGENT_RESOLVER
```

## Runtime Capability Discovery

The `AGENT_ADAPTERS` registry in [`interfaces/agent-api.ts`](../../interfaces/agent-api.ts)
contains the `universal-mcp` entry for MCP stdio server integration.

Capabilities are **runtime-discovered** — they are NOT static. Actual capabilities depend
on what the connecting MCP Client declares at runtime via `server.getClientCapabilities()`:

| Capability | Always Available | Condition |
|------------|-----------------|-----------|
| `mcp` proxy tool | ✅ Yes | — |
| Sampling | ℹ️ Runtime | Agent declares `sampling` capability |
| Elicitation | ℹ️ Runtime | Agent declares `elicitation.form` capability |
| Status/panel | ℹ️ Runtime | Via tool actions and content blocks |

> Sampling is forwarded via MCP `sampling/createMessage` reverse call.
> Elicitation is forwarded via `elicitation/create` reverse call.

## Host × Target Matrix

When running integration tests, the host (current agent) and target (adapter under test)
are independent dimensions:

| Host \ Target | Path A (in-process) | Path B (spawn) | Path C (SDK_DIRECT) |
|---------------|---------------------|----------------|---------------------|
| Full mcp proxy | in-process + spawn E2E | spawn E2E | in-process (parametric) |
| directTools | in-process + directTools | directTools | in-process (parametric) |
| SDK_DIRECT | spawn required | spawn required | spawn required |

**Default**: host = current agent, target = universal-mcp, mode = in-process.

## Adding a New Agent

Any MCP-compatible agent uses the universal MCP server directly — just register
`mcp-server` in the agent's MCP config. No new adapter code is needed.

If an agent requires a native integration (custom AgentAPI implementation):

1. Implement `AgentAPI` (8 methods) in `adapters/<id>-adapter.ts`
2. Provide `AgentPathResolver` in `interfaces/agent-paths.ts`
3. Add descriptor to `AGENT_ADAPTERS` in `interfaces/agent-api.ts`
4. **Done.** This resolver.md auto-discovers the new agent via the registry.
