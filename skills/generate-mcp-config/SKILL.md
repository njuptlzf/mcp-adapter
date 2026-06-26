---
name: generate-mcp-config
description: Generate mcp.json configuration files for any mcp-adapter compatible agent (Pi, Qoder, Claude, Cursor, etc.). Creates global or project-level MCP server configs with correct paths, server entries, settings, and imports. Use when user says "生成mcp配置", "创建mcp.json", "配置MCP服务器", "generate mcp config", "create mcp.json", "configure MCP servers", or when setting up a new agent with mcp-adapter.
---

# Generate MCP Config

Generate correct `mcp.json` files for any mcp-adapter compatible agent.

## Quick Start

1. **Identify the target agent** — see Agent Path Map below
2. **Determine config scope** — global vs project
3. **Generate the JSON** — using the schema and templates below
4. **Validate** — check against the schema rules

## Agent Path Map

Each agent has a global config path and a project config filename. The `MCP_AGENT_DIR` env var overrides the global path for any agent.

| Agent | Global Config Path | Project Config | Resolver Factory |
|-------|-------------------|----------------|-----------------|
| Pi | `~/.pi/agent/mcp.json` | `.pi/mcp.json` | `createPiResolver()` |
| Qoder | `~/.qoder/agent/mcp.json` | `.mcp.json` | `createQoderResolver()` |
| Claude | `~/.claude/mcp.json` | `.mcp.json` | custom `AgentPathResolver` |
| Cursor | `~/.cursor/mcp.json` | `.mcp.json` | custom `AgentPathResolver` |
| Generic | `~/.config/mcp/mcp.json` | `.mcp.json` | `DEFAULT_AGENT_RESOLVER` (Pi) |

**Precedence** (highest to lowest):
1. `~/.config/mcp/mcp.json` — shared global
2. `<agent dir>/mcp.json` — agent global override
3. `.mcp.json` — shared project
4. `.<agent>/mcp.json` — agent project override (Pi only: `.pi/mcp.json`)

## Config Structure

The root object is `McpConfig`:

```json
{
  "mcpServers": { },
  "settings": { },
  "imports": [ ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mcpServers` | `Record<string, ServerEntry>` | Yes | MCP server definitions keyed by name |
| `settings` | `McpSettings` | No | Global adapter settings |
| `imports` | `ImportKind[]` | No | Compatibility imports from other hosts |

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
      "scope": "read write",
      "redirectUri": "http://localhost:3118/callback"
    },
    "lifecycle": "keep-alive"
  }
}
```

For all ServerEntry fields and detailed options, see [references/config-schema.md](references/config-schema.md).

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

Compatibility imports auto-merge server configs from other hosts:

```json
{
  "imports": ["cursor", "claude-code", "claude-desktop", "codex", "windsurf", "vscode"]
}
```

## Generation Workflow

### Step 1: Determine Agent

Ask or infer which agent the user is configuring:
- Mentioned "qoder" / "qodercli" → Qoder (`~/.qoder/agent/mcp.json`)
- Mentioned "pi" / "pi-coding-agent" → Pi (`~/.pi/agent/mcp.json`)
- Mentioned "claude" → Claude (`~/.claude/mcp.json`)
- Mentioned "cursor" → Cursor (`~/.cursor/mcp.json`)
- Not specified → ask the user

### Step 2: Determine Scope

- **Global**: User wants servers available across all projects → write to agent's global path
- **Project**: User wants servers for a specific project → write to `.mcp.json` in project root
- **Both**: Generate both files, placing shared servers globally and project-specific ones in `.mcp.json`

### Step 3: Collect Server Definitions

For each MCP server the user wants, determine:
1. **Transport type**: stdio (local command) or HTTP (remote URL)
2. **Command/URL**: The executable or endpoint
3. **Auth**: None, Bearer token, or OAuth
4. **Lifecycle**: `lazy` (default), `eager`, or `keep-alive`
5. **DirectTools**: Whether to promote tools to first-class (default: `false`)
6. **Environment variables**: Any env vars the server needs

### Step 4: Generate JSON

Assemble the config following these rules:
- Server names use kebab-case (e.g. `chrome-devtools`, not `chrome_devtools`)
- `env` values support `${VAR}` and `$env:VAR` interpolation
- `cwd` supports `${VAR}`, `$env:VAR`, and `~` expansion
- `args` is a JSON string when passed to the proxy tool, but an array in config
- `directTools: true` registers all tools; `directTools: ["tool_a"]` registers only listed tools
- `excludeTools` matches both original names (`get_screenshot`) and prefixed names (`figma_get_screenshot`)

### Step 5: Validate

Check the generated config:
1. Valid JSON (no trailing commas, no comments)
2. At least one server in `mcpServers` (unless only using `imports`)
3. Each server has either `command` (stdio) or `url` (HTTP), not both
4. `oauth` config only on HTTP servers with `auth: "oauth"`
5. `directTools` array items use original MCP tool names, not prefixed
6. `idleTimeout: 0` means disable (never timeout), not "immediate"

For common server templates, see [references/server-templates.md](references/server-templates.md).

## Agent Adapter Registry

The project's `AGENT_ADAPTERS` in `interfaces/agent-api.ts` is the source of truth for supported adapters:

| Adapter | UI | Sampling | Renderer | Status |
|---------|-----|----------|----------|--------|
| Pi | Full (notify, setStatus, form, theme) | Yes | Yes | First-class |
| Qoder | Minimal (notify only) | Yes | No | First-class |
| Others | Bring your own `AgentAPI` | TBD | TBD | Adapter pattern supported |

Adding a new adapter = implement `AgentAPI` interface (8 methods) + provide `AgentPathResolver` + push one descriptor to `AGENT_ADAPTERS`.

## Examples

### Example 1: Qoder project config with stdio servers

User says: "为 Qoder 项目配置 calculator 和 chrome-devtools 两个 MCP 服务器"

Generate `.mcp.json`:

```json
{
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": ["-y", "@example/calculator-mcp"],
      "lifecycle": "lazy"
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"],
      "lifecycle": "lazy",
      "directTools": ["take_screenshot", "navigate"]
    }
  }
}
```

### Example 2: Pi global config with OAuth HTTP server

User says: "在 Pi 全局配置一个需要 OAuth 认证的远程 MCP 服务器"

Generate `~/.pi/agent/mcp.json`:

```json
{
  "mcpServers": {
    "github-api": {
      "url": "https://api.github.com/mcp",
      "auth": "oauth",
      "oauth": {
        "grantType": "authorization_code",
        "clientId": "my-github-client-id",
        "scope": "repo read:user"
      },
      "lifecycle": "keep-alive"
    }
  },
  "settings": {
    "autoAuth": true,
    "idleTimeout": 30
  }
}
```

### Example 3: Shared config with imports

User says: "我之前在 Cursor 和 Claude Code 里配置了 MCP 服务器，想导入到 mcp-adapter"

Generate `~/.config/mcp/mcp.json`:

```json
{
  "imports": ["cursor", "claude-code"],
  "mcpServers": {
    "my-custom-server": {
      "command": "node",
      "args": ["/path/to/my-server.js"]
    }
  }
}
```

### Example 4: Qoder global config with Bearer auth

User says: "Qoder 全局配置一个带 Bearer token 的 HTTP MCP 服务器"

Generate `~/.qoder/agent/mcp.json`:

```json
{
  "mcpServers": {
    "internal-api": {
      "url": "https://internal.example.com/mcp",
      "auth": "bearer",
      "bearerTokenEnv": "INTERNAL_API_TOKEN",
      "lifecycle": "lazy"
    }
  },
  "settings": {
    "toolPrefix": "server",
    "idleTimeout": 15
  }
}
```

## Key Rules

1. **Server names**: kebab-case, will be converted to snake_case for tool prefixes (e.g. `chrome-devtools` → `chrome_devtools_take_screenshot`)
2. **Proxy tool**: By default, all tools are accessed through a single `mcp` proxy tool (~250 tokens). Use `directTools` to promote specific tools.
3. **Lazy by default**: Servers don't connect at startup — only on first tool call. Use `lifecycle: "eager"` or `"keep-alive"` for always-on servers.
4. **Env interpolation**: `${VAR}` reads from process env; `$env:VAR` is the same with PowerShell-style syntax.
5. **MCP_AGENT_DIR**: Overrides the global config directory for any agent (highest priority).
6. **No comments**: mcp.json is strict JSON — no `//` or `/* */` comments allowed.
