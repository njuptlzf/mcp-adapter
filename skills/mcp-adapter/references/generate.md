# Phase 1 Reference: Generate MCP Config

> **Called from**: `skills/mcp-adapter/SKILL.md` Phase 1
> **Migrated from**: `skills/generate-mcp-config/SKILL.md` (deprecated)
> **Path resolution**: See [resolver.md](resolver.md) — use `AGENT_ADAPTERS[i].resolverFactory()`

Generates correct `mcp.json` files for any mcp-adapter compatible agent.

## Agent Path Map

Each registered adapter provides an `AgentPathResolver` factory in `AGENT_ADAPTERS`.
Resolve dynamically:

```bash
echo "=== Discovered adapters ==="
grep -B1 -A5 "id:" interfaces/agent-api.ts | grep -E "(id:|displayName:|resolverFactory:)" | head -40
```

Concrete defaults (auto-discovered, do NOT hardcode):

| Agent | Global Config Path | Project Config |
|-------|-------------------|----------------|
| Pi | `~/.pi/agent/mcp.json` | `.mcp.json` (`.pi/mcp.json` override) |
| Qoder | `~/.qoder/agent/mcp.json` | `.mcp.json` |
| Kilo | `~/.kilo/mcp.json` | `.mcp.json` |

Override: `MCP_AGENT_DIR` env var for any agent. See [resolver.md](resolver.md) for full precedence.

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

### Step 1: Determine Agent (from Phase 0)

The target agent was already chosen in Phase 0 of the main skill. Use its `resolverFactory()`
to determine the config path.

### Step 2: Determine Scope

- **Global**: Agent global path (e.g. `~/.kilo/mcp.json`)
- **Project**: `.mcp.json` in project root
- **Both**: Shared servers globally, project-specific locally

### Step 3: Collect Server Definitions

For each MCP server:
1. **Transport**: stdio (local command) or HTTP (remote URL)
2. **Command/URL**: executable or endpoint
3. **Auth**: None, Bearer token, or OAuth
4. **Lifecycle**: `lazy` (default), `eager`, or `keep-alive`
5. **DirectTools**: whether to promote tools (default: `false`)
6. **Env vars**: any environment variables needed

### Step 4: Generate JSON

Rules:
- Server names use kebab-case
- `env` values support `${VAR}` and `$env:VAR` interpolation
- `cwd` supports `${VAR}`, `$env:VAR`, and `~` expansion
- `args` is JSON string in proxy calls, array in config
- `directTools: true` = all tools; `directTools: ["a","b"]` = selected
- `excludeTools` matches original and prefixed names

### Step 5: Validate

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
