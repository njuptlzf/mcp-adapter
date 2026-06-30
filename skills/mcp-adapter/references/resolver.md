# Agent Resolver Reference

Universal path resolution for the two integration branches: **Branch A (Pi)** and
**Branch C (Universal MCP)**. Config path discovery is fully universalized (D-02) —
no agent-specific global paths. This replaces the legacy per-agent resolver pattern.

## Dynamic Discovery

The `AGENT_ADAPTERS` registry in [`interfaces/agent-api.ts`](../../interfaces/agent-api.ts)
contains two entries: `pi` (Branch A) and `universal-mcp` (Branch C). For programmatic
consumption in skill workflows:

```bash
# Resolve the universal global config path
node -e "
const m = require('./interfaces/agent-paths.ts');  // handles .ts via tsx
const resolver = m.createUniversalResolver();
console.log(resolver.globalConfigPath());
"
```

## Agent Capability Matrix

Branch C capabilities are **runtime-discovered** (D-12) — they are NOT static.
The table below shows the architectural defaults; actual capabilities depend on what
the connecting MCP Client declares at runtime via `server.getClientCapabilities()`.

| Branch | Agent ID | UI | Sampling | Renderer | Integration Mode |
|--------|----------|-----|----------|----------|-----------------|
| Branch A | `pi` | ✅ | ✅ | ✅ | Native Pi extension (in-process) |
| Branch C | `universal-mcp` | runtime-discovered | runtime-discovered | runtime-discovered | Universal MCP stdio server (`mcp-server`) |

> **Branch C note**: Sampling is forwarded via MCP `sampling/createMessage` reverse call
> when the Agent Client declares `sampling` capability. Elicitation is forwarded via
> `elicitation/create` when the client declares `elicitation.form` capability. The `mcp`
> proxy tool is always available regardless of declared capabilities. TUI rendering is a
> Pi-only presentation enhancement (Branch A), not a Branch C capability gap (D-08).

## Config Path Resolution

The discovery chain is universal for all agents (D-02):

| Precedence | Source | Description |
|------------|--------|-------------|
| 1 (highest) | `--config` flag | Explicit path passed to `mcp-server` |
| 2 | `MCP_CONFIG_PATH` env var | Environment variable override |
| 3 | `.mcp.json` in cwd | Project-local shared config |
| 4 (lowest) | `~/.config/mcp/mcp.json` | User-global shared config |

> **Pi (Branch A) also reads**: `~/.pi/agent/mcp.json` (global override) and
> `.pi/mcp.json` (project override). These are Pi-specific layers on top of the
> universal chain. Branch C uses only the universal chain above.

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

## Capability-Gate Decision (DEC-03 + D-12)

Before deploying or generating config for an agent, check its capabilities.
For Branch C, capabilities are discovered at runtime — there is no static gate.

### Phase 0 Preamble

For Branch A (Pi), all capabilities are `true` — full support.

For Branch C (Universal MCP), present the runtime-discovery model:

```
Agent: <user-named>
Integration mode: Branch C (universal MCP stdio server)
Capabilities (runtime-discovered via MCP protocol):
  ✅ mcp proxy tool — always available
  ℹ️ Sampling — forwarded if agent declares `sampling` capability
  ℹ️ Elicitation — forwarded if agent declares `elicitation` capability
  ℹ️ Status/panel — via tool actions and content blocks
```

**Never terminate** — both branches support the `mcp` proxy tool. But **always display**
the capability model so the user knows what to expect.

## Host × Target Matrix (D-16)

When running integration tests, the host (current agent) and target (adapter under test)
are independent dimensions:

| Host \ Target | Path A (in-process) | Path B (spawn) | Path C (SDK_DIRECT) |
|---------------|---------------------|----------------|---------------------|
| Full mcp proxy | in-process + spawn E2E | spawn E2E | in-process (parametric) |
| directTools | in-process + directTools | directTools | in-process (parametric) |
| SDK_DIRECT | spawn required | spawn required | spawn required |

**Default**: host = current agent, target = all AGENT_ADAPTERS, mode = in-process.

## Adding a New Agent

With the universal MCP server architecture, **most agents do not need a new adapter**
(D-08). Any MCP-compatible agent uses Branch C directly — just register `mcp-server`
in the agent's MCP config.

If an agent requires a native integration (like Pi's Branch A):

1. Implement `AgentAPI` (8 methods) in `adapters/<id>-adapter.ts`
2. Provide `AgentPathResolver` in `interfaces/agent-paths.ts`
3. Add descriptor to `AGENT_ADAPTERS` in `interfaces/agent-api.ts`
4. **Done.** This resolver.md auto-discovers the new agent via the registry.
