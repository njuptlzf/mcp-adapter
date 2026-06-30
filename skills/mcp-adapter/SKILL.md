---
name: mcp-adapter
description: >
  Universal mcp-adapter skill — single entry point for integrating MCP into any coding agent.
  Handles config generation (Phase 1), adapter deployment (Phase 2), and verification (Phase 3).
  Replaces the deleted deploy-mcp-adapter, generate-mcp-config, and mcp-adapter-test skills.
  Use when user says "integrate agent", "deploy mcp-adapter", "install mcp-adapter",
  "add new agent", "generate mcp config", "create mcp.json", "configure MCP servers",
  "verify mcp-adapter", "test mcp-adapter", or any phrase
  about integrating mcp-adapter into an agent.
---

# MCP Adapter — Universal Agent Integration

Single entry point for all mcp-adapter workflows. What used to be three separate skills
(`deploy-mcp-adapter`, `generate-mcp-config`, `mcp-adapter-test`) is now one unified
skill with three phases. Each phase can run independently.

The old skill directories have been physically removed (Phase 11). This is the only
mcp-adapter skill.

## Architecture: Branch A + Branch C

There are exactly **two integration branches** (D-12):

- **Branch A (Pi)** — Native Pi extension. Install `pi-mcp-adapter` as a Pi extension.
  Provides full TUI panel, custom renderers, and in-process sampling via PiSamplingProvider.
  Pi is the only agent that uses Branch A (D-03).

- **Branch C (Universal MCP)** — Register the `mcp-server` bin entry in any
  MCP-compatible agent's config. The server is agent-agnostic — it speaks MCP protocol
  and discovers client capabilities at runtime. Sampling and elicitation are forwarded
  via MCP Server→Client reverse calls (`sampling/createMessage`, `elicitation/create`)
  when the agent declares those capabilities.

**Branch C is a COMPLETE implementation within the MCP protocol's scope** (D-08) — it is
NOT "lesser" than Branch A. Tool actions (`executeStatus`) and content
blocks provide equivalent functionality. What Pi Branch A provides extra is richer UI
(TUI rendering with ANSI codes), which is a presentation enhancement, not a capability
difference.

> The legacy SDK bridge approach was removed entirely in Phase 12 and is no longer documented.

## Quick Decision: Which Phase Do You Need?

**The Entry Gate (Step E1) asks this question automatically.** This table is for
reference when the user's intent is already clear from their message.

| User intent | Phase to run | Skip others? |
|-------------|-------------|--------------|
| "Integrate agent / deploy mcp-adapter" | Phase 0 → 1 → 2 → 3 | Full pipeline |
| "Generate mcp.json config" | Phase 1 only | Yes |
| "Verify mcp-adapter deployment" | Phase 3 | Yes |

## Workflow Checklist

```
Progress:
- [ ] Entry Gate: Confirm user intent (deploy? config? verify?)
- [ ] Phase 0: Identify target agent (Pi or other MCP-compatible?)
- [ ] Phase 1: Generate mcp.json config
- [ ] Phase 2: Deploy adapter into target agent
- [ ] Phase 3: Verify deployment
```

---

## Entry Gate (MANDATORY — runs before any phase)

**Do NOT jump directly to Phase 0.** First, confirm the user's intent.

### Step E1: Ask what the user wants to do

Use `AskUserQuestion` with these options:

- **"Integrate agent (deploy mcp-adapter)"** → Enter Phase 0 → 1 → 2 → 3
- **"Generate mcp.json config only"** → Jump to Phase 1
- **"Verify existing mcp-adapter deployment"** → Jump to Phase 3

If the user's original message already states a clear intent (e.g. "deploy to my agent",
"generate mcp config", "verify deployment"), skip this question and route directly.

Only after the user confirms they want to **integrate an agent** should Phase 0 begin.

---

## Phase 0: Identify Target Agent

**Runs only when the user wants to integrate an agent.** Asks a single question to
determine the integration branch (D-12).

### Step 0.1: Ask "Pi or other MCP-compatible agent?"

Use `AskUserQuestion` with these options:

- **"Pi"** → Branch A (native extension install via `pi install npm:pi-mcp-adapter`)
- **"Other MCP-compatible agent"** → Branch C (register `mcp-server` in the agent's MCP config)

> **No registry reading, no static capability matrix.** Capabilities are discovered at
> runtime when the Agent connects as MCP Client (D-12). There is no need to inspect
> `AGENT_ADAPTERS` or `package.json` bin patterns — the user's answer alone determines
> the branch.

### Step 0.2: Present branch summary

Display the determined branch and what to expect:

**If Branch A (Pi):**
```
Agent: Pi
Integration mode: Branch A (native Pi extension)
Capabilities:
  ✅ mcp proxy tool (~200 tokens)
  ✅ Interactive TUI panel (/mcp, /mcp setup)
  ✅ In-process sampling (PiSamplingProvider)
  ✅ Custom renderers (ANSI TUI)
  ✅ Elicitation forms + URL prompts
```

**If Branch C (Universal MCP):**
```
Agent: <user-named or "any MCP-compatible agent">
Integration mode: Branch C (universal MCP stdio server via mcp-server)
Capabilities (runtime-discovered via MCP protocol):
  ✅ mcp proxy tool (~200 tokens)
  ℹ️ Sampling — forwarded if agent declares `sampling` capability
  ℹ️ Elicitation — forwarded if agent declares `elicitation` capability
  ℹ️ Status/panel — via tool actions (executeStatus) and content blocks

Branch C is a complete implementation. Capabilities are discovered at
runtime when the agent connects as MCP Client — no static matrix needed.
```

**Never terminate** — both branches support the `mcp` proxy tool. Always display the
branch summary so the user knows what to expect.

---

## Phase 1: Generate MCP Config

Creates the `mcp.json` configuration file for the target agent.

**When to run this phase alone**: User says "generate mcp config", "create mcp.json", "configure MCP servers".

**When to run as part of full pipeline**: Phase 0 → 1 → 2 → 3 (config must exist before deploy).

### Step 1.1: Determine config path

The config path discovery chain is **universal** (D-02) — it does not depend on which
agent is being configured:

| Precedence | Source | Example |
|------------|--------|---------|
| 1 (highest) | `--config` flag | `mcp-server --config /path/to/mcp.json` |
| 2 | `MCP_CONFIG_PATH` env var | `export MCP_CONFIG_PATH=/path/to/mcp.json` |
| 3 | `.mcp.json` in current working directory | `./.mcp.json` |
| 4 (lowest) | Shared global config | `~/.config/mcp/mcp.json` |

> For Branch A (Pi), Pi also reads Pi-owned override files:
> `~/.pi/agent/mcp.json` (global) and `.pi/mcp.json` (project).
> For Branch C, the universal chain above is the only discovery path.

### Step 1.2: Determine scope

- **Global**: Write to `~/.config/mcp/mcp.json` (available across all projects)
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

### Step 2.1: Confirm deployment branch (already determined in Phase 0)

The integration mode was already determined in Step 0.1. Proceed to execution:

| Branch | Agent | Command |
|--------|-------|---------|
| Branch A (native install) | Pi | `pi install npm:pi-mcp-adapter` |
| Branch C (universal MCP stdio) | Any MCP-compatible agent | Register `mcp-server` in agent's MCP config |

### Step 2.2: Execute branch-specific deployment

See [references/deploy.md](references/deploy.md) for complete deployment code templates per branch:

- **Branch A (Pi)**: `pi install npm:pi-mcp-adapter` — provides TUI panel, custom renderers, in-process sampling
- **Branch C (Universal MCP)**: Register `mcp-server` in the agent's `mcpServers` config. The server discovers client capabilities at runtime and forwards sampling/elicitation via MCP protocol reverse calls when supported.

### Step 2.3: Verify deployment

Universal check that works for any registered adapter:

```bash
# The mcp proxy tool must be registered
npm run verify:deploy -- --agent universal-mcp
```

For runtime confirmation, restart the target agent and look for the `mcp` tool.

---

## Phase 3: Verify Deployment

Runs the full integration test matrix to confirm mcp-adapter works correctly.

**When to run this phase alone**: User says "verify mcp-adapter", "test mcp-adapter".

### Step 3.1: Quick verification

```bash
npm run verify:deploy -- --agent universal-mcp
```

Checks: adapter creation → context → config loading → tool registration → session lifecycle.

### Step 3.2: Full test suite

See [references/verify.md](references/verify.md) for the complete test matrix including
MockAgent compatibility, token benchmarks, E2E validation, and protocol forwarder tests.

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Which skill do I use?" | Use this skill (`/mcp-adapter`). It's the only one you need. |
| "mcp tool not found" | Ensure Phase 2 deployment completed; restart target agent; run Phase 3 verification |
| "No mcp.json found" | Run Phase 1 first, then return to Phase 2 |
| "Agent not MCP-compatible?" | Branch C works with any agent that speaks MCP protocol. Register `mcp-server` in the agent's MCP config. |

## References

| File | Content |
|------|---------|
| [references/resolver.md](references/resolver.md) | Universal path resolution + capability matrix (Pi + Universal MCP) |
| [references/generate.md](references/generate.md) | Phase 1 config generation workflow |
| [references/deploy.md](references/deploy.md) | Phase 2 deployment code templates (Branch A + Branch C) |
| [references/verify.md](references/verify.md) | Phase 3 verification workflow |
| [references/deploy-examples.md](references/deploy-examples.md) | Complete code templates (preserved from legacy) |
