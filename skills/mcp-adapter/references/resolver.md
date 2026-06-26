# Agent Resolver Reference

Unified path resolution for all registered adapters. Dynamically discovered from
`AGENT_ADAPTERS` in [`interfaces/agent-api.ts`](../../interfaces/agent-api.ts) —
**no static per-agent files needed.** This replaces the legacy
`skills/mcp-adapter-test/references/agent-paths/<id>.md` pattern (Phase 11 DEC-02).

## Dynamic Discovery

Run this to see all currently registered adapters with their paths and capabilities:

```bash
echo "=== Current AGENT_ADAPTERS ==="
grep -B1 -A5 "id:" interfaces/agent-api.ts | grep -E "(id:|displayName:|capabilities:|resolverFactory:)" | head -60
```

For programmatic consumption in skill workflows:

```bash
# Resolve an agent's global config path
node -e "
const m = require('./interfaces/agent-paths.ts');  // handles .ts via tsx
const resolver = m.createKiloResolver();  // or createPiResolver, createQoderResolver
console.log(resolver.globalConfigPath());
"
```

## Agent Capability Matrix

Read from `AGENT_ADAPTERS[i].capabilities`. Updated automatically when new adapters are registered.

| Agent ID | Display Name | UI | Sampling | Renderer | Integration Mode |
|----------|-------------|-----|----------|----------|-----------------|
| `pi` | Pi | ✅ | ✅ | ✅ | Native ExtensionAPI (Branch A) |
| `qoder` | Qoder | ❌ | ✅ | ❌ | SDK Bridge + SessionStart hook (Branch B) |
| `kilo` | Kilo | ❌ | ❌ | ❌ | MCP stdio server (Branch C / Strategy A) |

> **Kilo note**: `sampling` and `renderer` are ❌ because Kilo uses MCP stdio transport,
> which does not support server→client reverse calls. The `mcp` proxy tool is fully functional.

## Config Path Resolution

For each agent, resolve the global config directory via `resolverFactory()`:

| Agent | Global Config Path | Project Config | Override Env |
|-------|-------------------|----------------|--------------|
| Pi | `~/.pi/agent/mcp.json` | `.mcp.json` (`.pi/mcp.json` project override) | `PI_CODING_AGENT_DIR` |
| Qoder | `~/.qoder/agent/mcp.json` | `.mcp.json` | `MCP_AGENT_DIR` |
| Kilo | `~/.kilo/mcp.json` | `.mcp.json` | `MCP_AGENT_DIR` |

Precedence (all agents): `--config` flag > `MCP_AGENT_DIR` env > agent-global > shared-global (`~/.config/mcp/mcp.json`) > project (`.mcp.json`).

### Using PATH-01 Self-Reporting

When an agent knows its config path at runtime, pass it via `AgentContext.mcpConfigPath`:

```typescript
const resolver = createKiloResolver();
const ctx: AgentContext = adaptKiloContext({ 
  cwd: process.cwd(), 
  hasUI: false,
  mcpConfigPath: resolver.globalConfigPath()  // PATH-01 self-reporting
});
// loadMcpConfig will use ctx.mcpConfigPath before falling back to DEFAULT_AGENT_RESOLVER
```

## Capability-Gate Decision (DEC-03)

Before deploying or generating config for an agent, check its capabilities.

### Phase 0 Preamble

For every agent interaction in this skill, run this preamble:

```bash
# 1. Identify target agent from AGENT_ADAPTERS
# 2. Read its capabilities
# 3. Present to user
```

**Decision table:**

| Condition | Action |
|-----------|--------|
| All capabilities `false` | ⚠️ Warn: basic mcp proxy only. No UI/sampling/renderer. Proceed anyway. |
| `ui: false` | ℹ️ Note: no interactive panel. CLI-only. |
| `sampling: false` | ℹ️ Note: MCP sampling unavailable (agent has no model registry access). |
| `renderer: false` | ℹ️ Note: custom tool renderers unavailable (notify-only). |
| Any `true` | ✅ Full support for that capability. |

**Never terminate** — all registered agents support the `mcp` proxy tool. But **always display**
capability differences so the user knows what to expect.

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

1. Implement `AgentAPI` (8 methods) in `adapters/<id>-adapter.ts`
2. Provide `AgentPathResolver` in `interfaces/agent-paths.ts`
3. Add descriptor to `AGENT_ADAPTERS` in `interfaces/agent-api.ts`
4. **Done.** This resolver.md auto-discovers the new agent via the registry.

No need to create a per-agent reference file or update any skill — the registry
is the single source of truth (D-07).
