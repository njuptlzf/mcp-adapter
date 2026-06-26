# Config Schema Reference

Complete field reference for `McpConfig` and all sub-types. Source of truth: `types.ts`.

## McpConfig (root)

```typescript
interface McpConfig {
  mcpServers: Record<string, ServerEntry>;
  imports?: ImportKind[];
  settings?: McpSettings;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mcpServers` | `Record<string, ServerEntry>` | Yes | Server definitions keyed by name. Names should be kebab-case. |
| `imports` | `ImportKind[]` | No | Compatibility imports from other host configs |
| `settings` | `McpSettings` | No | Global adapter settings |

## ServerEntry

```typescript
interface ServerEntry {
  // Stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  
  // HTTP transport
  url?: string;
  headers?: Record<string, string>;
  
  // Authentication
  auth?: "oauth" | "bearer" | false;
  bearerToken?: string;
  bearerTokenEnv?: string;
  oauth?: OAuthConfig | false;
  
  // Lifecycle
  lifecycle?: "keep-alive" | "lazy" | "eager";
  idleTimeout?: number;
  
  // Tool behavior
  exposeResources?: boolean;
  directTools?: boolean | string[];
  excludeTools?: string[];
  
  // Debug
  debug?: boolean;
}
```

### Transport Fields

| Field | Type | Applies to | Description |
|-------|------|-----------|-------------|
| `command` | `string` | stdio | Executable to run (e.g. `npx`, `node`, `python`) |
| `args` | `string[]` | stdio | Command arguments |
| `env` | `Record<string,string>` | stdio | Environment variables; supports `${VAR}` and `$env:VAR` |
| `cwd` | `string` | stdio | Working directory; supports `${VAR}`, `$env:VAR`, `~` |
| `url` | `string` | HTTP | Server endpoint URL (StreamableHTTP with SSE fallback) |
| `headers` | `Record<string,string>` | HTTP | HTTP headers; supports `${VAR}` and `$env:VAR` |

> A server must have either `command` (stdio) or `url` (HTTP), not both.

### Auth Fields

| Field | Type | Description |
|-------|------|-------------|
| `auth` | `"oauth" \| "bearer" \| false` | Auth type. If omitted with `url` present, OAuth is auto-detected. |
| `bearerToken` | `string` | Static bearer token; supports `${VAR}` and `$env:VAR` |
| `bearerTokenEnv` | `string` | Name of env var containing the token |
| `oauth` | `OAuthConfig \| false` | OAuth configuration. `false` explicitly disables OAuth. |

### OAuthConfig

```typescript
interface OAuthConfig {
  grantType?: "authorization_code" | "client_credentials";
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  redirectUri?: string;
  clientName?: string;
  clientUri?: string;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `grantType` | `string` | `"authorization_code"` | OAuth flow type. Use `"client_credentials"` for non-interactive M2M auth. |
| `clientId` | `string` | (dynamic) | Pre-registered client ID. Omit for dynamic registration. |
| `clientSecret` | `string` | — | Client secret for confidential clients |
| `scope` | `string` | — | Requested OAuth scopes (space-separated) |
| `redirectUri` | `string` | (auto-assigned) | Exact callback URI for pre-registered clients (e.g. `http://localhost:3118/callback`) |
| `clientName` | `string` | — | Display name for dynamic registration |
| `clientUri` | `string` | — | Homepage URI for dynamic registration |

### Lifecycle Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `lifecycle` | `string` | `"lazy"` | Connection mode: `lazy` (on-demand), `eager` (at startup), `keep-alive` (always-on with auto-reconnect) |
| `idleTimeout` | `number` | `10` | Minutes before idle disconnect. `0` = never disconnect. Per-server overrides global setting. |

### Tool Behavior Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `exposeResources` | `boolean` | `true` | Expose MCP resources as tools |
| `directTools` | `boolean \| string[]` | `false` | `true` = all tools as direct host-agent tools; `["tool_a"]` = only listed tools; `false` = proxy only |
| `excludeTools` | `string[]` | — | Tool names to hide. Matches both original (`get_screenshot`) and prefixed (`figma_get_screenshot`) names. |
| `debug` | `boolean` | `false` | Show server stderr output |

> `directTools` array items must use **original MCP tool names**, not prefixed names.

## McpSettings

```typescript
interface McpSettings {
  toolPrefix?: "server" | "none" | "short";
  idleTimeout?: number;
  directTools?: boolean;
  disableProxyTool?: boolean;
  autoAuth?: boolean;
  sampling?: boolean;
  samplingAutoApprove?: boolean;
  elicitation?: boolean;
  elicitationAutoOpenUrls?: boolean;
  authRequiredMessage?: string;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `toolPrefix` | `string` | `"server"` | Prefix mode: `"server"` (full server name), `"short"` (strips `-mcp` suffix), `"none"` (no prefix) |
| `idleTimeout` | `number` | `10` | Global idle timeout in minutes. `0` = disable. Per-server overrides this. |
| `directTools` | `boolean` | `false` | Global default for all servers. Per-server `directTools` overrides. |
| `disableProxyTool` | `boolean` | `false` | Hide the `mcp` proxy tool when direct tools are fully available from cache. |
| `autoAuth` | `boolean` | `false` | Auto-run OAuth on `connect`/tool calls when auth is needed, then retry once. |
| `sampling` | `boolean` | `true` (when UI available) | Allow MCP servers to sample through agent models. |
| `samplingAutoApprove` | `boolean` | `false` | Skip sampling confirmation prompts. Required for non-UI sessions. |
| `elicitation` | `boolean` | `true` (when UI available) | Allow MCP servers to request user input through host UI. |
| `elicitationAutoOpenUrls` | `boolean` | `false` | Auto-open URL elicitations without prompting. |
| `authRequiredMessage` | `string` | (TUI instruction) | Custom message for auth-required tool results. `"${server}"` is substituted. |

## ImportKind

```typescript
type ImportKind = "cursor" | "claude-code" | "claude-desktop" | "codex" | "windsurf" | "vscode";
```

Each import reads from the host's native config path:

| Import | Config Path |
|--------|-------------|
| `cursor` | `~/.cursor/mcp.json` |
| `claude-code` | `~/.claude/mcp.json` or `~/.claude.json` or `~/.claude/claude_desktop_config.json` |
| `claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| `codex` | `~/.codex/config.json` |
| `windsurf` | `~/.windsurf/mcp.json` |
| `vscode` | `.vscode/mcp.json` |

## Tool Naming

Tool names are prefixed based on `toolPrefix` setting:

| Mode | Server: `chrome-devtools` | Server: `xcodebuild-mcp` |
|------|--------------------------|--------------------------|
| `"server"` (default) | `chrome_devtools_take_screenshot` | `xcodebuild_mcp_list_sims` |
| `"short"` | `chrome_devtools_take_screenshot` | `xcodebuild_list_sims` |
| `"none"` | `take_screenshot` | `list_sims` |

- Hyphens in server names are converted to underscores
- `"short"` mode strips `-mcp` or `mcp` suffix from server name
- Fuzzy matching: `context7_resolve_library_id` finds `context7_resolve-library-id`

## Config File Precedence

When multiple config files exist, servers are merged with project-level overriding global:

1. `~/.config/mcp/mcp.json` — shared global (lowest priority)
2. `<agent dir>/mcp.json` — agent global override
3. `.mcp.json` — shared project
4. `.<agent>/mcp.json` — agent project override (Pi only: `.pi/mcp.json`)

> Same server name in a higher-priority file completely replaces the lower-priority entry. It does NOT merge fields.

## Environment Variable Interpolation

Supported in `env` values, `headers` values, `bearerToken`, `cwd`:

| Syntax | Description | Example |
|--------|-------------|---------|
| `${VAR}` | Standard interpolation | `"${GITHUB_TOKEN}"` |
| `$env:VAR` | PowerShell-style (equivalent) | `"$env:GITHUB_TOKEN"` |
| `~` | Home directory (cwd only) | `"~/projects"` |

> Undefined env vars resolve to empty string. No error is thrown.
