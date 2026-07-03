---
name: mcp-adapter
description: >
  Universal mcp-adapter skill — deploys mcp-adapter into any MCP-compatible coding agent.
  Handles agent discovery (Phase 0), config generation (Phase 1), adapter deployment
  (Phase 2), and verification (Phase 3). Use when user says "integrate agent",
  "deploy mcp-adapter", "install mcp-adapter", "add new agent", "generate mcp config",
  "create mcp.json", "configure MCP servers", "verify mcp-adapter", "test mcp-adapter",
  or any phrase about integrating mcp-adapter into an agent.
---

# MCP Adapter — Universal Agent Integration

Single entry point for deploying mcp-adapter into target coding agents. The adapter
registers a single `mcp` proxy tool (~200 tokens) that consolidates hundreds of MCP
tool definitions into one, dramatically reducing token overhead.

> **Pi users**: Pi is the origin agent for this package. Just run
> `pi install npm:pi-mcp-adapter` — no skill needed. This skill is for deploying
> into OTHER MCP-compatible agents.

## How It Works

mcp-adapter runs as an MCP stdio server (`mcp-server` bin). Register it in the target
agent's MCP config, and the agent's MCP client auto-discovers it via stdio. The server
is agent-agnostic — it speaks MCP protocol and discovers client capabilities at runtime.

Capabilities (runtime-discovered via MCP protocol):
- ✅ `mcp` proxy tool (~200 tokens) — always available
- ℹ️ Sampling — forwarded if agent declares `sampling` capability
- ℹ️ Elicitation — forwarded if agent declares `elicitation` capability
- ℹ️ Status/panel — via tool actions (`executeStatus`) and content blocks

## Quick Decision: Which Phase Do You Need?

| User intent | Phase to run | Skip others? |
|-------------|-------------|--------------|
| "Integrate agent / deploy mcp-adapter" | Phase 0 → 1 → 2 → 3 | Full pipeline |
| "Generate mcp.json config" | Phase 1 only | Yes |
| "Verify existing mcp-adapter deployment" | Phase 3 | Yes |

## Workflow Checklist

```
Progress:
- [ ] Entry Gate: Confirm user intent (deploy? config? verify?)
- [ ] Phase 0.1: Collect target agent input (user-supplied name or path)
- [ ] Phase 0.2: Collect scope (Global / Project / Both)
- [ ] Phase 0.3: Discover MCP config + verify compatibility
- [ ] Phase 0.4: Present discovery summary
- [ ] Phase 1: Generate mcp.json config (scope already set in 0.2)
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

---

## Phase 0: Identify Target Agent + Collect Scope + Verify MCP Compatibility

**Runs only when the user wants to integrate an agent.** Collects the target
agent's identity (Step 0.1) and the config scope (Step 0.2), then discovers
the MCP config location (Step 0.3) and verifies MCP protocol support.

### Step 0.1: Ask "Which agent do you want to deploy to?"

Use `AskUserQuestion` with these options. **Do NOT hardcode any specific
agent name as a Label** — options describe how the user wants to identify
the target, and the user supplies the name/path themselves.

- **"By agent name"** — User provides the agent's identifier
  (e.g. qoder, claude, cursor, kilo, cline, opencode). The host agent
  looks up the config path from the table in Step 0.3.
- **"By binary path"** — User provides the full path to the agent's
  executable (e.g. `/usr/local/bin/qodercli`). The host agent verifies the
  binary exists and is executable.
- **"Generic MCP-compatible"** — User does not know the name. The host
  agent falls back to the universal config (`~/.config/mcp/mcp.json`).

> The user should only need to name the agent — they should NOT need to know
> the agent's MCP config path or integration mode. The host agent discovers
> that automatically in Step 0.3.
>
> If the user specifies a binary path, verify the binary exists and is
> executable before proceeding.

### Step 0.2: Ask scope — global or project?

Immediately after Step 0.1 (same Phase 0, no other steps in between),
collect the configuration scope. This is the second deployment-intent
dimension and must be gathered alongside the agent identity.

Use `AskUserQuestion` with these options:

- **"Global"** — Write to the agent's global config path (available across
  all projects)
- **"Project"** — Write to `.mcp.json` in current project root (scoped to
  this project)
- **"Both"** — Shared servers globally, project-specific ones locally

> Both Step 0.1 (agent) and Step 0.2 (scope) are deployment-intent
> dimensions. Collecting them back-to-back avoids a context switch later.
> The config path itself is resolved in Step 0.3 using the agent name from
> Step 0.1 plus the scope from Step 0.2.

### Step 0.3: Discover agent's MCP config and verify compatibility

Based on the user's answers from Step 0.1 (agent identity) and Step 0.2
(scope), the host agent investigates the target agent:

**1. Check known config paths** for the named agent:

| Agent | Global Config Path | Project Config |
|-------|-------------------|----------------|
| Qoder | `~/.qoder/agent/mcp.json` | `.mcp.json` |
| Claude Code | `~/.claude/agent/mcp.json` | `.mcp.json` |
| Cursor | `~/.cursor/mcp.json` | `.mcp.json` |
| Kilo | `~/.kilo/mcp.json` | `.mcp.json` |
| (universal fallback) | `~/.config/mcp/mcp.json` | `.mcp.json` |

Override: `MCP_AGENT_DIR` env var for any agent.

> If the user-selected name from Step 0.1 does not match any row above,
> fall back to the universal row. The scope from Step 0.2 determines which
> column (Global vs Project vs Both) is written in Phase 1.

**2. Check if the agent binary exists**:

```bash
which <agent-name> 2>/dev/null || which <agent-binary> 2>/dev/null
```

**3. Check if the agent supports MCP protocol**:

- Look for `mcpServers` key in the agent's existing config file
- Check if the agent's config directory exists
- If the agent has no MCP support → **STOP and inform the user**:

```
Agent "<name>" does not appear to support MCP protocol.
mcp-adapter requires the target agent to support MCP servers (mcpServers config).
Deployment aborted.
```

> **Do NOT guess.** If MCP support cannot be confirmed from config files or
> documentation, ask the user to confirm: "Does <agent> support MCP servers
> (mcpServers in its config)? If yes, where is its config file?"

### Step 0.4: Present discovery summary

Display what was found so the user knows what to expect:

```
Agent: <name>
MCP support: ✅ Confirmed (mcpServers config found at <path>)
Config path: <global-path> (global) / .mcp.json (project)
Scope: <Global | Project | Both>  (from Step 0.2)
Binary: <path or "not found in PATH — user must ensure mcp-server is accessible">
```

**Never proceed without confirming MCP compatibility.** If the check is inconclusive,
ask the user to verify manually.

---

## Phase 1: Generate MCP Config

Creates the `mcp.json` configuration file for the target agent.

**When to run this phase alone**: User says "generate mcp config", "create mcp.json".

**When to run as part of full pipeline**: Phase 0 → 1 → 2 → 3 (config must exist before deploy).

> The config scope (Global / Project / Both) was already collected in
> Phase 0 Step 0.2. Do NOT re-ask here. Use that scope to determine the
> write path.

### Step 1.1: Collect server definitions

For each MCP server the user wants to configure:

1. **Transport**: stdio (local command) or HTTP (remote URL)
2. **Command/URL**: executable or endpoint
3. **Auth**: None, Bearer token, or OAuth
4. **Lifecycle**: `lazy` (default), `eager`, or `keep-alive`
5. **DirectTools**: whether to promote tools (default: `false`)
6. **Env vars**: any environment variables needed

See [references/generate.md](references/generate.md) for the full config schema.

### Step 1.2: Generate JSON and write to config path

Write the config to the path determined by Phase 0 Step 0.1 (agent identity)
+ Phase 0 Step 0.2 (scope):

```json
{
  "mcpServers": {
    "mcp-adapter": {
      "command": "mcp-server"
    }
  }
}
```

Rules:
- Server names use kebab-case
- `env` values support `${VAR}` interpolation
- `directTools: true` = all tools; `directTools: ["a","b"]` = selected
- `idleTimeout: 0` = disable
- No comments — mcp.json is strict JSON

### Step 1.3: Validate

1. Valid JSON (no trailing commas, no comments)
2. At least one server in `mcpServers`
3. Each server has `command` (stdio) or `url` (HTTP), not both
4. `oauth` only on HTTP servers with `auth: "oauth"`

See [references/generate.md](references/generate.md) for validation checklist.

---

## Phase 2: Deploy Adapter

Registers `mcp-server` in the target agent's MCP config so the agent gets a single
`mcp` proxy tool.

**Prerequisite**: Phase 1 must complete first (mcp.json must exist).

### Step 2.1: Ensure mcp-server is available

```bash
# Check if mcp-server is in PATH
which mcp-server

# If not installed globally, install the package
npm install -g pi-mcp-adapter
```

### Step 2.2: Register mcp-adapter in target agent's config

Ensure the `mcp-adapter` entry exists in the target agent's `mcpServers` config
(written in Phase 1):

```json
{
  "mcpServers": {
    "mcp-adapter": {
      "command": "mcp-server"
    }
  }
}
```

> The `mcp-server` bin is agent-agnostic. It speaks MCP protocol and discovers
> client capabilities at runtime. No agent-specific configuration is needed.

### Step 2.3: Quick deployment verification

```bash
npm run verify:deploy -- --agent universal-mcp
```

For runtime confirmation, restart the target agent and look for the `mcp` tool.

See [references/deploy.md](references/deploy.md) for deployment details.

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
|---------|---------|
| "mcp tool not found" | Restart target agent; ensure `mcp-server` is registered in mcpServers config |
| "No mcp.json found" | Run Phase 1 first, then return to Phase 2 |
| "Agent not MCP-compatible?" | Check if the agent has `mcpServers` config support. If not, it cannot use mcp-adapter. |
| "mcp-server not in PATH" | `npm install -g pi-mcp-adapter` to install the bin globally |

## References

| File | Content |
|------|---------|
| [references/resolver.md](references/resolver.md) | Config path resolution + agent discovery |
| [references/generate.md](references/generate.md) | Phase 1 config generation workflow |
| [references/deploy.md](references/deploy.md) | Phase 2 deployment details |
| [references/verify.md](references/verify.md) | Phase 3 verification workflow |
| [references/deploy-examples.md](references/deploy-examples.md) | Complete code templates |
