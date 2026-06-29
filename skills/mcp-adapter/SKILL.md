---
name: mcp-adapter
description: >
  Universal mcp-adapter skill — single entry point for integrating MCP into any coding agent.
  Handles config generation (Phase 1), adapter deployment (Phase 2), and verification (Phase 3).
  Replaces the deleted deploy-mcp-adapter, generate-mcp-config, and mcp-adapter-test skills.
  Use when user says "对接agent", "部署mcp-adapter", "安装mcp-adapter", "接入新agent",
  "生成mcp配置", "创建mcp.json", "配置MCP服务器", "验证mcp-adapter", "测试mcp-adapter",
  "deploy mcp-adapter", "generate mcp config", "test mcp-adapter", or any phrase
  about integrating mcp-adapter into an agent.
---

# MCP Adapter — Universal Agent Integration

Single entry point for all mcp-adapter workflows. What used to be three separate skills
(`deploy-mcp-adapter`, `generate-mcp-config`, `mcp-adapter-test`) is now one unified
skill with three phases. Each phase can run independently.

The old skill directories have been physically removed (Phase 11). This is the only
mcp-adapter skill.

## Quick Decision: Which Phase Do You Need?

**The Entry Gate (Step E1) asks this question automatically.** This table is for
reference when the user's intent is already clear from their message.

| User intent | Phase to run | Skip others? |
|-------------|-------------|--------------|
| "I want to create an mcp.json config file" | Phase 1 only | Yes |
| "I want to install mcp-adapter into agent X" | Phase 0 → 1 → 2 | Phase 1 runs automatically |
| "I want to verify my mcp-adapter deployment" | Phase 3 | Yes |
| "I want to fully integrate agent X" | Phase 0 → 1 → 2 → 3 | Full pipeline |

## Workflow Checklist

```
Progress:
- [ ] Entry Gate: Confirm user intent (deploy? config? verify? full pipeline?)
- [ ] Phase 0: Identify target agent + capability-gate (deploy/integrate only)
- [ ] Phase 1: Generate mcp.json config
- [ ] Phase 2: Deploy adapter into target agent
- [ ] Phase 3: Verify deployment
```

---

## Entry Gate (MANDATORY — runs before any phase)

**Do NOT jump directly to Phase 0.** First, confirm the user's intent.

### Step E1: Ask what the user wants to do

Use `AskUserQuestion` with these options:

- **"生成 mcp.json 配置文件"** → Jump to Phase 1 (ask agent in Phase 1 context)
- **"安装 mcp-adapter 到某个 agent"** → Enter Phase 0 → 1 → 2
- **"验证已有的 mcp-adapter 部署"** → Jump to Phase 3
- **"完整集成某个 agent（全流程）"** → Enter Phase 0 → 1 → 2 → 3

If the user's original message already states a clear intent (e.g. "部署到 Qoder",
"生成 mcp 配置", "验证部署"), skip this question and route directly.

Only after the user confirms they want to **deploy/integrate** should Phase 0 begin.

---

## Phase 0: Identify Target Agent + Capability-Gate

**Runs only when the user wants to deploy or fully integrate.** Identifies which agent
to integrate and checks what capabilities it supports.

### Step 0.1: Read the registry

**Single source of truth**: `AGENT_ADAPTERS` in [`interfaces/agent-api.ts`](../../interfaces/agent-api.ts).

```bash
grep -B1 -A5 "id:" interfaces/agent-api.ts | grep -E "(id:|displayName:|capabilities:)" | head -40
```

For each descriptor capture: `id`, `displayName`, `capabilities`.

### Step 0.2: Show capability table, then ask which agent

**First**, present the full capability matrix as a readable table (derived from `AGENT_ADAPTERS`):

```
Available agents:
| Agent  | MCP Proxy | UI Panel | Sampling | Renderer | Integration Mode       |
|--------|-----------|----------|----------|----------|------------------------|
| Kilo   | ✅        | ❌       | ❌       | ❌       | MCP stdio server       |
| Pi     | ✅        | ✅       | ✅       | ✅       | Native ExtensionAPI    |
| Qoder  | ✅        | ❌       | ✅       | ❌       | SDK bridge             |
```

**Then**, use `AskUserQuestion` to select the target agent. Each option:

- **Label**: `displayName` only (e.g. "Kilo", "Pi", "Qoder")
- **Description**: one-line integration mode (e.g. "MCP stdio server 模式"), **NOT** capability flags

Always append: "Custom Agent (not in registry — requires implementing AgentAPI first)"

### Step 0.3: Capability-Gate (DEC-03)

Read the chosen agent's `capabilities` and present a transparent summary:

```
Agent: Kilo
Capabilities:
  ✅ mcp proxy tool (~250 tokens) — fully supported
  ❌ UI panel — MCP stdio protocol limitation
  ❌ Sampling — requires in-process SDK
  ❌ Custom renderers — notify-only

Proceed? This agent will get full MCP proxy functionality.
Only advanced features (sampling, interactive UI) are unavailable.
```

**Never terminate** — all registered agents support `mcp` proxy. But **always display** the
capability summary so the user knows what to expect. See [references/resolver.md](references/resolver.md#capability-gate-decision-dec-03) for the full decision table.

---

## Phase 1: Generate MCP Config

Creates the `mcp.json` configuration file for the target agent.

**When to run this phase alone**: User says "生成mcp配置", "创建mcp.json", "配置MCP服务器".

**When to run as part of full pipeline**: Phase 0 → 1 → 2 → 3 (config must exist before deploy).

### Step 1.1: Determine config path

For the chosen agent, resolve the config path using the registry:

```bash
# Dynamically discover the agent's config path
node -e "
const m = require('./interfaces/agent-paths.ts');
const resolver = m.createKiloResolver();  // use the resolver for the chosen agent
console.log(resolver.globalConfigPath());
"
```

Or use the table in [references/resolver.md](references/resolver.md#config-path-resolution).

### Step 1.2: Determine scope

- **Global**: Write to agent's global config path (available across all projects)
- **Project**: Write to `.mcp.json` in project root (scoped to current project)
- **Both**: Shared servers globally, project-specific ones locally

### Step 1.3: Collect server definitions and generate JSON

See [references/generate.md](references/generate.md) for the full config generation workflow
(Step 3-5 of the legacy generate-mcp-config skill).

### Step 1.4: Validate

Check the generated config is valid JSON, has at least one server, and follows
the schema rules. See [references/generate.md](references/generate.md) for validation checklist.

---

## Phase 2: Deploy Adapter

Deploys mcp-adapter into the target agent's runtime so it gets a single `mcp` proxy tool.

**Prerequisite**: Phase 1 must complete first (mcp.json must exist).

### Step 2.1: Map agent to deployment branch

From the agent's entry point pattern:

| Pattern | Branch | Agent |
|---------|--------|-------|
| `pi.extensions` in package.json | Branch A (native install) | Pi |
| `bin["<id>-mcp-bridge"]` | Branch B (SDK bridge) | Qoder |
| `bin["<id>-mcp-server"]` | Branch C / Strategy A (MCP stdio) | Kilo |
| Not in registry | Branch C (custom AgentAPI) | (new agent) |

### Step 2.2: Execute branch-specific deployment

See [references/deploy.md](references/deploy.md) for complete deployment code templates per branch:

- **Branch A (Pi)**: `pi install npm:pi-mcp-adapter`
- **Branch B (Qoder)**: Create entry script + register SessionStart hook + bridge via SDK
- **Branch C (Kilo)**: Register `kilo-mcp-server` in agent's mcpServers config
- **Branch C (Custom)**: Implement AgentAPI + provide resolver + wire through createMcpAdapter

### Step 2.3: Verify deployment

Universal check that works for any registered adapter:

```bash
# The mcp proxy tool must be registered
npm run verify:deploy -- --agent <id>
```

For runtime confirmation, restart the target agent and look for the `mcp` tool.

---

## Phase 3: Verify Deployment

Runs the full integration test matrix to confirm mcp-adapter works correctly.

**When to run this phase alone**: User says "验证mcp-adapter", "test mcp-adapter".

### Step 3.1: Quick verification

```bash
npm run verify:deploy -- --agent <id>
```

Checks: adapter creation → context → config loading → tool registration → session lifecycle.

### Step 3.2: Full test suite

See [references/verify.md](references/verify.md) for the complete test matrix including
MockAgent compatibility, token benchmarks, E2E validation, and Host × Target parametric tests.

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Which skill do I use?" | Use this skill (`/mcp-adapter`). It's the only one you need. |
| "mcp tool not found" | Ensure Phase 2 deployment completed; restart target agent; run Phase 3 verification |
| "No mcp.json found" | Run Phase 1 first, then return to Phase 2 |
| "Agent not in registry" | Select "Custom Agent" in Phase 0; implement AgentAPI (8 methods) + AgentPathResolver |

## References

| File | Content |
|------|---------|
| [references/resolver.md](references/resolver.md) | Unified path resolution + capability matrix (replaces agent-paths) |
| [references/generate.md](references/generate.md) | Phase 1 config generation workflow |
| [references/deploy.md](references/deploy.md) | Phase 2 deployment code templates |
| [references/verify.md](references/verify.md) | Phase 3 verification workflow |
| [references/deploy-examples.md](references/deploy-examples.md) | Complete code templates (preserved from legacy) |
