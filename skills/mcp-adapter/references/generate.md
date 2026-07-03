# Phase 1 Reference: Generate MCP Config

> **Called from**: `skills/mcp-adapter/SKILL.md` Phase 1
> **Path resolution**: See [resolver.md](resolver.md) — agent discovery protocol

Generates correct `mcp.json` files for the target agent.

## Agent Config Paths

The target agent's config path was discovered in Phase 0. Common paths:

| Agent | Global Config Path | Project Config |
|-------|-------------------|----------------|
| Qoder | `~/.qoder/agent/mcp.json` | `.mcp.json` |
| Claude Code | `~/.claude/agent/mcp.json` | `.mcp.json` |
| Cursor | `~/.cursor/mcp.json` | `.mcp.json` |
| Kilo | `~/.kilo/mcp.json` | `.mcp.json` |
| (universal fallback) | `~/.config/mcp/mcp.json` | `.mcp.json` |

Override: `MCP_AGENT_DIR` env var for any agent. See [resolver.md](resolver.md) for
the full discovery protocol.

## Config Structure

```json
{
  "mcpServers": { },
  "settings": { },
  "imports": [ ]
}
```

### ServerEntry (stdio)

```json
{
  "my-server": {
    "command": "npx",
    "args": ["-y", "some-mcp-server"],
    "env": { "API_KEY": "${MY_API_KEY}" },
    "cwd": "~",
    "lifecycle": "lazy",
    "idleTimeout": 10,
    "directTools": false,
    "excludeTools": [],
    "debug": false
  }
}
```

### ServerEntry (HTTP)

```json
{
  "remote-server": {
    "url": "https://example.com/mcp",
    "headers": { "Authorization": "Bearer ${TOKEN}" },
    "auth": "oauth",
    "oauth": {
      "grantType": "authorization_code",
      "clientId": "my-client-id",
      "scope": "read write"
    },
    "lifecycle": "keep-alive"
  }
}
```

### McpSettings

```json
{
  "settings": {
    "toolPrefix": "server",
    "idleTimeout": 10,
    "directTools": false,
    "disableProxyTool": false,
    "autoAuth": false,
    "sampling": true,
    "samplingAutoApprove": false,
    "elicitation": true,
    "elicitationAutoOpenUrls": false
  }
}
```

### Imports

```json
{
  "imports": ["cursor", "claude-code", "claude-desktop", "codex", "windsurf", "vscode"]
}
```

## Generation Workflow

### Step 1: Determine agent and config path (from Phase 0)

The target agent and its config path were already discovered in Phase 0.
Use the discovered path based on the scope chosen in Step 1.1:

- **Global**: Write to the agent's global config path
- **Project**: Write to `.mcp.json` in project root
- **Both**: Shared servers globally, project-specific locally

### Step 2: Collect server definitions

For each MCP server:

1. **Transport**: stdio (local command) or HTTP (remote URL)
2. **Command/URL**: executable or endpoint
3. **Auth**: None, Bearer token, or OAuth
4. **Lifecycle**: `lazy` (default), `eager`, or `keep-alive`
5. **DirectTools**: whether to promote tools (default: `false`)
6. **Env vars**: any environment variables needed

### Step 3: Generate JSON

Rules:
- Server names use kebab-case
- `env` values support `${VAR}` and `$env:VAR` interpolation
- `cwd` supports `${VAR}`, `$env:VAR`, and `~` expansion
- `args` is JSON string in proxy calls, array in config
- `directTools: true` = all tools; `directTools: ["a","b"]` = selected
- `excludeTools` matches original and prefixed names
- No comments — mcp.json is strict JSON

### Step 4: Validate

1. Valid JSON (no trailing commas, no comments)
2. At least one server in `mcpServers`
3. Each server has `command` (stdio) or `url` (HTTP), not both
4. `oauth` only on HTTP servers with `auth: "oauth"`
5. `directTools` array uses original MCP names, not prefixed
6. `idleTimeout: 0` = disable, not "immediate"

## Key Rules

1. **Server names**: kebab-case, auto-converted to snake_case for tool prefixes
2. **Proxy tool**: single `mcp` tool (~250 tokens) by default; use `directTools` to promote
3. **Lazy by default**: servers connect on first use, not startup
4. **Env interpolation**: `${VAR}` from process env; `$env:VAR` PowerShell-style
5. **MCP_AGENT_DIR**: overrides global config dir (highest priority)
6. **No comments**: mcp.json is strict JSON
