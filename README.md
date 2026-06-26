<p>
  <img src="banner.png" alt="pi-mcp-adapter" width="1100">
</p>

# Universal MCP Adapter

A universal MCP (Model Context Protocol) adapter with **Pi as a first-class supported adapter** (not legacy) — and every other MCP-compatible coding agent is welcome via the same `AgentAPI` / `UISystem` interfaces.

Use MCP servers without burning your context window, from Pi today and from any MCP-compatible coding agent via the [Supported Agents](#supported-agents) matrix below.

## Supported Agents

Pi is a first-class supported adapter (not legacy). New agents plug in through `AGENT_ADAPTERS` in `interfaces/agent-api.ts` — adding a new adapter = one descriptor push, no other code changes.

The **single source of truth** for supported adapters is the `AGENT_ADAPTERS` array in [`interfaces/agent-api.ts`](interfaces/agent-api.ts). The table below is a human-readable snapshot; when in doubt, read the registry directly:

```bash
# Show all currently registered adapters
grep -B1 -A5 "id:" interfaces/agent-api.ts | grep -E "(id:|displayName:|capabilities:)" | head -40
```

| Agent | Status | Default config path | Path resolver | Sampling | Renderer | Verified at |
|-------|--------|---------------------|---------------|----------|----------|-------------|
| Pi | ✅ First-class | `~/.pi/agent/mcp.json` | `createPiResolver()` | ✅ | ✅ | [tests/reports/mcp-adapter-test-report.md](tests/reports/mcp-adapter-test-report.md) |
| Qoder | ✅ First-class | `~/.qoder/agent/mcp.json` | `createQoderResolver()` | ✅ | ❌ (notify-only) | [tests/reports/mcp-adapter-test-report.md](tests/reports/mcp-adapter-test-report.md) |
| Kilo | ✅ MCP stdio server | `~/.kilo/mcp.json` | `createKiloResolver()` | ❌ | ❌ | `bin/kilo-mcp-server.ts` |
| Claude, Cursor, others | 🟡 Adapter pattern supported — bring your own `AgentAPI` implementation | TBD | TBD | TBD | TBD | TBD |

> **Kilo note**: Kilo's `❌❌` (sampling/renderer) is an architectural constraint, not missing implementation.
> Kilo integrates via MCP stdio server — it has no public TypeScript SDK, so it cannot support
> reverse calls (server→client) that sampling and custom renderers require. The core `mcp` proxy
> tool and all MCP server proxying features are fully functional. Qoder's `❌` (renderer) is by
> design — its `UISystem` surface is intentionally notify-only.

See [Verification](#verification) below for the latest matrix results.

https://github.com/user-attachments/assets/4b7c66ff-e27e-4639-b195-22c3db406a5a

## Why This Exists

Mario wrote about [why you might not need MCP](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/). The problem: tool definitions are verbose. A single MCP server can burn 10k+ tokens, and you're paying that cost whether you use those tools or not. Connect a few servers and you've burned half your context window before the conversation starts.

His take: skip MCP entirely, write simple CLI tools instead.

But the MCP ecosystem has useful stuff - databases, browsers, APIs. This adapter gives you access without the bloat. One proxy tool (~200 tokens) instead of hundreds. The agent discovers what it needs on-demand. Servers only start when you actually use them. The same engine drives Pi today; other agents plug in through the [`AgentAPI` / `UISystem` interfaces](#universal-adapter) without touching MCP server code.

## Install

### For Pi users (recommended)

```bash
pi install npm:pi-mcp-adapter
```

Restart Pi after installation. The rest of this README focuses on the Pi integration; for other agents see [Universal Adapter](#universal-adapter).

### For other agents

This package ships a small agent-agnostic surface ([`AgentAPI` / `UISystem`](#the-shape)). To plug it into a different coding agent, write a thin adapter that implements those interfaces and instantiate the MCP machinery through it. See the full [Universal Adapter](#universal-adapter) section for a working mock example.

## What happens on first run (Pi)

The adapter reads standard MCP files automatically. No extra setup needed if you already have them.

| You already have... | What happens |
|---------------------|--------------|
| `.mcp.json` or `~/.config/mcp/mcp.json` | The shared MCP files are picked up immediately. The first time you open `/mcp`, you'll see a short heads-up explaining which file was detected and that the adapter only writes host-specific overrides to its own files (Pi: `~/.pi/agent/mcp.json`). |
| Host-specific configs (Cursor, Claude Code, Codex, etc.) but no standard MCP files | Run `/mcp setup` to adopt those host configs into the shared MCP format. The setup flow shows exactly what it found, lets you pick which ones to import, and previews the exact file changes before writing. |
| Nothing configured yet | Run `/mcp setup` to scaffold a minimal `.mcp.json`, quick-add RepoPrompt, or inspect what the adapter discovered on your machine. |

If you prefer the terminal, you can also run `pi-mcp-adapter init` after install to scan for host-specific configs and add missing compatibility imports to the host agent dir (Pi: `~/.pi/agent/mcp.json` by default, or `$PI_CODING_AGENT_DIR/mcp.json` when set).

## Quick Start

The adapter ships two entry points: the Pi-native `mcpAdapter(pi)` for Pi users (backward-compatible) and the universal `createMcpAdapter(adapter, ctx, config, cache)` for any `AgentAPI` adapter. Both produce the same proxy tool behavior.

### Pi users (Pi-native entry point)

```typescript
import { mcpAdapter } from "pi-mcp-adapter";

export default mcpAdapter(pi); // Pi's ExtensionAPI — backward-compatible
```

### Universal entry point (any AgentAPI adapter)

```typescript
import { createMcpAdapter } from "pi-mcp-adapter";
import { PiAdapter } from "pi-mcp-adapter/adapters/pi-adapter";
import { QoderAdapter } from "pi-mcp-adapter/adapters/qoder-adapter";

// Pick the adapter matching your agent
const adapter = process.env.MCP_AGENT_ID === "qoder"
  ? new QoderAdapter()
  : new PiAdapter(pi); // or your own AgentAPI implementation

createMcpAdapter(adapter, ctx, config, cache); // works for any adapter
```

---

The examples below show the Pi path's tool-call syntax. The same MCP server config and the same `mcp` proxy tool shape are reused across agents through the [Supported Agents](#supported-agents) matrix above.

Preferred project config: `.mcp.json`

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

Preferred user-global shared config: `~/.config/mcp/mcp.json`

Pi also reads Pi-owned override files for settings and host-specific compatibility:

- `<Pi agent dir>/mcp.json` — Pi global override (`~/.pi/agent/mcp.json` by default)
- `.pi/mcp.json` — Pi project override

Precedence is:

1. `~/.config/mcp/mcp.json`
2. `<Pi agent dir>/mcp.json`
3. `.mcp.json`
4. `.pi/mcp.json`

Servers are **lazy by default** — they won't connect until you actually call one of their tools. The adapter caches tool metadata so search and describe work without live connections.

```
mcp({ search: "screenshot" })
```
```
chrome_devtools_take_screenshot
  Take a screenshot of the page or element.

  Parameters:
    format (enum: "png", "jpeg", "webp") [default: "png"]
    fullPage (boolean) - Full page instead of viewport
```
```
mcp({ tool: "chrome_devtools_take_screenshot", args: '{"format": "png"}' })
```

Note: `args` is a JSON string, not an object.

Two calls instead of 26 tools cluttering the context.

## Verification

The `mcp-adapter-test` skill runs a full integration matrix across every registered adapter. Latest report: [tests/reports/mcp-adapter-test-report.md](tests/reports/mcp-adapter-test-report.md) (auto-generated by `tests/reporters/matrix-reporter.ts`).

Run the matrix yourself:

```bash
npm run test:prebuild  # build visualizer dist/ (FIX-01)
npx vitest run          # full matrix, ~30s
```

Latest matrix (auto-refreshed by the reporter):

| Adapter | Section 4 (MockAgent) | Section 5 (Token Bench) | Section 5B (Conv Sim) | Section 6 (E2E) |
|---------|------------------------|--------------------------|----------------------|------------------|
| Pi      | 44/44                  | 94% savings 🟡            | 56% savings 🟡        | 25/25            |
| Qoder   | 44/44                  | 94% savings 🟡            | 56% savings 🟡        | 25/25            |

🟡 = baseline-bound (fixture-determined, identical across adapters — see `docs/mcp-adapter-token-savings.md`).

## Config

### File Layout

Use the shared MCP files when you want one setup to work across hosts, and host-owned files when a specific agent needs its own overrides or settings.

| File | Purpose | Owner |
|------|---------|-------|
| `~/.config/mcp/mcp.json` | User-global shared MCP config | Shared |
| `.mcp.json` | Project-local shared MCP config | Shared |
| `<Pi agent dir>/mcp.json` | Pi global override and compatibility imports (`~/.pi/agent/mcp.json` by default) | Pi |
| `.pi/mcp.json` | Pi project override | Pi |

Pi-specific files are the write targets for imported or shared global servers when Pi needs to persist adapter-only settings such as `directTools`. For other agents, see [Universal Adapter](#universal-adapter) — `interfaces/agent-paths.ts` exposes the same contract as `AgentPathResolver` (`createPiResolver()` is the default).

### Server Options

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "some-mcp-server"],
      "lifecycle": "lazy",
      "idleTimeout": 10
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `command` | Executable for stdio transport |
| `args` | Command arguments |
| `env` | Environment variables; supports `${VAR}` and `$env:VAR` interpolation |
| `cwd` | Working directory; supports `${VAR}`, `$env:VAR`, and `~` expansion |
| `url` | HTTP endpoint (StreamableHTTP with SSE fallback) |
| `headers` | HTTP headers; supports `${VAR}` and `$env:VAR` interpolation |
| `auth` | `"bearer"` or `"oauth"` |
| `oauth.grantType` | `"authorization_code"` (default) or `"client_credentials"` for non-interactive machine auth |
| `oauth.clientId` | Pre-registered OAuth client ID; dynamic registration is used when omitted |
| `oauth.clientSecret` | OAuth client secret for confidential clients |
| `oauth.scope` | Requested OAuth scopes |
| `oauth.redirectUri` | Exact localhost redirect URI for browser OAuth, including port and path, for providers that pre-register callbacks |
| `oauth.clientName` | Client display name advertised during dynamic registration |
| `oauth.clientUri` | Client homepage URI advertised during dynamic registration |
| `bearerToken` / `bearerTokenEnv` | Token or env var name; `bearerToken` supports `${VAR}` and `$env:VAR` interpolation |
| `lifecycle` | `"lazy"` (default), `"eager"`, or `"keep-alive"` |
| `idleTimeout` | Minutes before idle disconnect (overrides global) |
| `exposeResources` | Expose MCP resources as tools (default: true) |
| `directTools` | `true`, `string[]`, or `false` — register tools individually instead of through proxy |
| `excludeTools` | `string[]` of tool names to hide (matches original names like `get_screenshot` and prefixed names like `figma_get_screenshot`) |
| `debug` | Show server stderr (default: false) |

For pre-registered browser OAuth clients, set `oauth.redirectUri` to the exact callback registered with the provider, for example `"http://localhost:3118/callback"`. Dynamic clients normally omit it and use a lazy OS-assigned localhost callback port.

### Lifecycle Modes

- **`lazy`** (default) — Don't connect at startup. Connect on first tool call. Disconnect after idle timeout. Cached metadata keeps search/list working without connections.
- **`eager`** — Connect at startup but don't auto-reconnect if the connection drops. No idle timeout by default (set `idleTimeout` explicitly to enable).
- **`keep-alive`** — Connect at startup. Auto-reconnect via health checks. No idle timeout. Use for servers you always need available.

### Settings

```json
{
  "settings": {
    "toolPrefix": "server",
    "idleTimeout": 10
  },
  "mcpServers": { }
}
```

| Setting | Description |
|---------|-------------|
| `toolPrefix` | `"server"` (default), `"short"` (strips `-mcp` suffix), or `"none"` |
| `idleTimeout` | Global idle timeout in minutes (default: 10, 0 to disable) |
| `directTools` | Global default for all servers (default: false). Per-server overrides this. |
| `disableProxyTool` | Hide the `mcp` proxy tool once configured direct tools are fully available from cache. |
| `autoAuth` | Auto-run OAuth on `connect`/tool calls when a server needs auth, then retry once (default: false). |
| `sampling` | Allow MCP servers to sample through Pi models, honoring `modelPreferences.hints` before current/default fallback (default: true when UI approval is available). |
| `samplingAutoApprove` | Skip sampling confirmation prompts. Required for sampling in non-UI sessions (default: false). |
| `elicitation` | Allow MCP servers to request user input through Pi UI forms/URL prompts (default: true when Pi UI form support is available). |
| `elicitationAutoOpenUrls` | Automatically open URL elicitations without prompting first (default: false). |

Per-server `idleTimeout` overrides the global setting.

### MCP Elicitation

When the host agent exposes UI (e.g. Pi's `ctx.ui.form()`), the adapter advertises MCP elicitation support. Form elicitations are rendered through the host's UI primitive and map agent actions to MCP actions: submit → `accept`, secondary → `decline`, cancel → `cancel`. URL elicitations prompt before opening a browser unless `elicitationAutoOpenUrls` is enabled. Hosts that don't ship a UI form capability simply don't advertise the form elicitation path.

### Direct Tools

By default, all MCP tools are accessed through the single `mcp` proxy tool. This keeps context small but means the LLM has to discover MCP tools via proxy search. If you want specific tools to show up directly in the host agent's tool list — alongside `read`, `bash`, `edit`, etc. — add `directTools` to your config.

Per-server:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"],
      "directTools": true
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "directTools": ["search_repositories", "get_file_contents"]
    },
    "huge-server": {
      "command": "npx",
      "args": ["-y", "mega-mcp@latest"]
    }
  }
}
```

| Value | Behavior |
|-------|----------|
| `true` | Register all tools from this server as individual host-agent tools |
| `["tool_a", "tool_b"]` | Register only these tools (use original MCP names) |
| Omitted or `false` | Proxy only (default) |

To set a global default for all servers:

```json
{
  "settings": {
    "directTools": true
  },
  "mcpServers": {
    "huge-server": {
      "directTools": false
    }
  }
}
```

Per-server `directTools` overrides the global setting. The example above registers direct tools for every server except `huge-server`.

To exclude specific tools while still using `directTools: true`, add `excludeTools` on the server:

```json
{
  "mcpServers": {
    "figma": {
      "url": "http://localhost:3845/mcp",
      "directTools": true,
      "excludeTools": ["get_figjam", "figma_get_code_connect_map"]
    }
  }
}
```

`excludeTools` filters direct tools, proxy search/list/describe, and the `/mcp` panel view.

Each direct tool costs ~150-300 tokens in the system prompt (name + description + schema). Good for targeted sets of 5-20 tools. For servers with 75+ tools, stick with the proxy or pick specific tools with a `string[]`.

Direct tools register from the metadata cache in the host agent dir (Pi: `~/.pi/agent/mcp-cache.json` by default, or `$PI_CODING_AGENT_DIR/mcp-cache.json` when set), so no server connections are needed at startup. On the first session after adding `directTools` to a new server, the cache won't exist yet — tools fall back to proxy-only and the cache populates in the background. To force it: `/mcp reconnect <server>` (Pi) or the equivalent reconnect action on your host agent.

When you change direct-tool toggles in `/mcp` (Pi) or write new config through `/mcp setup`, the extension triggers the host agent's normal reload flow automatically. That refreshes extensions, prompts, skills, and MCP tool registration in one shot, so newly configured direct tools can appear without a manual restart.

**Interactive configuration (Pi):** Run `/mcp` to open an interactive panel showing all servers with connection status, tools, and direct/proxy toggles. You can reconnect servers and toggle tools between direct and proxy from the same overlay. For OAuth, press Enter on a server that needs auth or `ctrl+a` on any OAuth server. Other agents expose equivalent affordances through their own UI surfaces.

**Guided first-run setup (Pi):** Run `/mcp setup` to inspect detected shared MCP files, adopt compatibility imports from other hosts, open discovered config paths, preview exact before/after file diffs for writes, scaffold a minimal project `.mcp.json`, or quick-add RepoPrompt into a standard/shared MCP file.

**Subagent integration (Pi subagent extension):** If you use the subagent extension, agents can request direct MCP tools in their frontmatter with `mcp:server-name` syntax. See the subagent README for details.

### MCP UI Integration

MCP servers can ship interactive UIs via the [MCP UI](https://github.com/MCP-UI-Org/mcp-ui) standard. When you call a tool that has a UI resource, the adapter opens it in a native macOS window via [Glimpse](https://github.com/hazat/glimpse) if available, otherwise falls back to the browser.

**How it works:**

1. Agent calls a tool like `launch_dashboard`
2. The tool's metadata includes `_meta.ui.resourceUri` pointing to a UI resource
3. pi-mcp-adapter fetches the UI HTML and opens it in an iframe
4. The UI can call MCP tools and send messages back to the agent

**Native rendering:** On macOS, if [Glimpse](https://github.com/hazat/glimpse) is installed (`pi install npm:glimpseui`), UIs open in a native WKWebView window instead of a browser tab. Set `MCP_UI_VIEWER=browser` to force the browser, or `MCP_UI_VIEWER=glimpse` to require native rendering.

**Bidirectional communication:** The UI talks back. When it sends a prompt or intent, the message is stored and `triggerTurn()` wakes the agent. The agent retrieves messages via `mcp({ action: "ui-messages" })` and responds, enabling conversational UIs where the app and agent collaborate in real-time.

**Session reuse:** When the agent calls the same tool again while its UI is already open, the adapter pushes the new result to the existing window instead of replacing it. This enables live updates — the agent can refine a chart, add data, or respond to user input without losing the current view. Different tools still replace the session as before.

**Message types from UI:**

| Type | Purpose |
|------|---------|
| `prompt` | User message that triggers an agent response |
| `intent` | Structured action with name + params |
| `notify` | Fire-and-forget notification |
| `message` | Generic message payload |
| (custom) | Any other type forwarded as intent |

**Retrieving UI messages:**

```
mcp({ action: "ui-messages" })
```

Returns accumulated messages from UI sessions. Each message includes `type`, `sessionId`, `serverName`, `toolName`, and `timestamp`. Prompt messages include `prompt`, intent messages include `intent` and `params`.

**Browser controls:**

- **Cmd/Ctrl+Enter** — Complete and close
- **Escape** — Cancel and close
- **Done/Cancel buttons** — Same as keyboard shortcuts

**Technical notes:**

- Tool consent gates whether UIs can call MCP tools (never/once-per-server/always)
- Works with both stdio and HTTP MCP servers
- Uses a local 408KB AppBridge bundle (MCP SDK + Zod) for browser↔server communication

### Local Example: Interactive Visualizer

A minimal MCP UI example at `examples/interactive-visualizer` demonstrating charts, bidirectional messaging, and streaming. From that directory:

```bash
npm install
npm run build
npm run install-local
```

Restart pi, then ask the agent to show a chart — it calls `show_chart` and opens the UI in Glimpse (macOS) or the browser. Use `npm run uninstall-local` to remove the MCP entry.

### Import Existing Configs

Shared MCP files are loaded automatically. Use `imports` only for host-specific config formats that are not already covered by `.mcp.json` or `~/.config/mcp/mcp.json`.

```json
{
  "imports": ["cursor", "claude-code", "claude-desktop"],
  "mcpServers": { }
}
```

Supported compatibility imports: `cursor`, `claude-code`, `claude-desktop`, `vscode`, `windsurf`, `codex`

`pi-mcp-adapter init` detects these host-specific configs and adds missing imports to the host agent dir config (Pi: `~/.pi/agent/mcp.json`) for you.

### Project Config

Prefer `.mcp.json` for project-local shared MCP config. Use `.pi/mcp.json` only when you need a Pi-specific project override. Project files override both user-global shared MCP config and Pi global overrides.

## Usage

| Mode | Example |
|------|---------|
| Status | `mcp({ })` |
| List server | `mcp({ server: "name" })` |
| Search | `mcp({ search: "screenshot navigate" })` |
| Describe | `mcp({ describe: "tool_name" })` |
| Call | `mcp({ tool: "...", args: '{"key": "value"}' })` |
| Connect | `mcp({ connect: "server-name" })` |
| UI messages | `mcp({ action: "ui-messages" })` |

MCP proxy and direct-tool results render compactly by default: long text shows the first three lines plus a `Ctrl+O to expand` hint, while the full result remains available when expanded and is still returned unchanged to the model.

Search includes both MCP tools and host-agent tools (from extensions). Host-agent tools appear first with `[host tool]` prefix. Space-separated words are OR'd.

Tool names are fuzzy-matched on hyphens and underscores — `context7_resolve_library_id` finds `context7_resolve-library-id`.

## Commands (Pi)

The `/mcp` and `/mcp-auth` slash commands are Pi-specific UI shortcuts. On other agents, call the equivalent MCP actions directly via the proxy tool or the agent's own command surface — the underlying behaviour is identical; only the trigger differs.

| Command | What it does |
|---------|--------------|
| `/mcp` | Interactive panel and first-run onboarding surface |
| `/mcp setup` | Guided setup for imports, a minimal `.mcp.json`, RepoPrompt quick-add, and config-path inspection |
| `/mcp tools` | List all tools |
| `/mcp reconnect` | Reconnect all servers |
| `/mcp reconnect <server>` | Connect or reconnect a single server |
| `/mcp logout <server>` | Clear stored OAuth credentials for a server and disconnect it |
| `/mcp-auth` | Open an OAuth server picker in interactive UI sessions |
| `/mcp-auth <server>` | OAuth setup for a specific server |

If `settings.autoAuth` is `true`, `mcp({ connect: ... })`, `mcp({ tool: ... })`, and direct tool calls automatically run OAuth when needed and retry once.

In Pi's interactive sessions, you can also authenticate from `/mcp` with `ctrl+a` or Enter on a server that needs auth. In non-interactive sessions, browser-based OAuth still requires `/mcp-auth <server>`. `/mcp-auth` without a server only opens a picker in the interactive UI.

## Universal Adapter

This package exposes a small, agent-agnostic surface so any coding agent can drive the same MCP machinery that powers the Pi integration. Pi is the first and most complete implementation; new agents plug in by implementing two interfaces and instantiating the MCP machinery through them.

### The shape

```typescript
// interfaces/agent-api.ts (source of truth)
export interface AgentAPI {
  registerTool(tool: ToolRegistration): void;
  registerCommand(name: string, config: CommandConfig): void;
  registerFlag(name: string, config: FlagConfig): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  getAllTools(): ToolInfo[];
  getFlag(name: string): string | undefined;
  sendMessage(message: unknown, options?: unknown): void;
  exec(command: string, args: string[]): Promise<unknown>;
}

export interface AgentContext {
  cwd: string;
  hasUI: boolean;
  ui?: UISystem;
  model?: string;
  modelRegistry?: unknown;
  signal?: AbortSignal;
  reload?(): Promise<void>;
}

export interface UISystem {
  notify(message: string, level: "info" | "warning" | "error"): void;
  setStatus(key: string, value: string | undefined): void;
  form?(config: FormConfig): Promise<FormResult>;
  custom?(renderer: UIRenderer, options: UIOptions): void;
  theme?: { fg(color: string, text: string): string };
}
```

The Pi implementation lives in `adapters/pi-adapter.ts` (wraps `ExtensionAPI` from `@earendil-works/pi-coding-agent`) and ships an `adaptPiContext(ctx)` helper that maps a Pi `ExtensionContext` into an `AgentContext`. The full mapping table — every method, every field, every Pi call site — is in [`MAPPING.md`](./MAPPING.md).

### Wiring a non-Pi agent

The example below is a fully self-contained mock agent — no real LLM, no network — that exercises every `AgentAPI` method the adapter actually uses. Drop it into a scratch file to smoke-test the contract:

```typescript
// NOTE: `McpAdapter` is shown here as the future universal entry point.
// At the time of writing, the canonical Pi entry is `mcpAdapter(pi)` from
// index.ts. A `McpAdapter` constructor that takes (AgentAPI, AgentContext)
// is the planned Phase-4+ surface; the rest of this snippet is the
// intended end-state shape, not yet shipped.

import type {
  AgentAPI,
  AgentContext,
  AgentId,
  AgentPathResolver,
  ToolInfo,
  ToolRegistration,
  CommandConfig,
  FlagConfig,
  FormConfig,
  FormResult,
  UISystem,
} from "./interfaces/agent-api";
// In an external consumer, replace the path above with the published package
// name (currently `pi-mcp-adapter`) once the type-only subpath export lands.

class MockAgent implements AgentAPI {
  private tools: ToolRegistration[] = [];
  private flags: Record<string, string> = {};
  private listeners = new Map<string, ((...args: unknown[]) => void)[]>();

  registerTool(tool: ToolRegistration) {
    this.tools.push(tool);
  }
  registerCommand(_name: string, _cfg: CommandConfig) {
    /* host agent's own command surface */
  }
  registerFlag(name: string, _cfg: FlagConfig) {
    /* declare a flag the adapter will read via getFlag() */
    this.flags[name] = "";
  }
  on(event: string, handler: (...args: unknown[]) => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }
  getAllTools(): ToolInfo[] {
    return this.tools as unknown as ToolInfo[];
  }
  getFlag(name: string) {
    return this.flags[name];
  }
  sendMessage(message: unknown, _options?: unknown) {
    console.log("[mock-agent] message:", message);
  }
  async exec(command: string, args: string[]): Promise<unknown> {
    return { command, args, ts: Date.now() };
  }
}

const mock = new MockAgent();
const ctx: AgentContext = {
  cwd: process.cwd(),
  hasUI: false,
};

// Future Phase-4+ universal entry. Today: use `mcpAdapter(pi)` from index.ts.
// new McpAdapter(mock, ctx).activate();

// A custom path resolver for the mock agent:
const resolver: AgentPathResolver = {
  id: "mock" as AgentId,
  globalConfigPath: () => "/tmp/mock-mcp.json",
  projectConfigPath: () => ".mcp.json",
  agentDir: () => "/tmp/mock-agent",
  cachePath: () => "/tmp/mock-agent/mcp-cache.json",
  authDir: () => "/tmp/mock-agent/mcp-oauth",
};
```

### Path resolution across agents

Config file lookup is itself pluggable. `interfaces/agent-paths.ts` defines `AgentPathResolver`; `createPiResolver()` is the default factory and `DEFAULT_AGENT_RESOLVER` is wired into `config.ts`. For a new agent, provide a resolver that returns the agent's global MCP config path, then thread it through `getConfigSources(resolver)`. The existing `getPiGlobalConfigPath()` wrapper is kept as a backward-compat shim around `resolveAgentGlobalConfigPath()` so Pi users see no behaviour change.

### What you get

- One `mcp` tool in context (~200 tokens) instead of hundreds
- Lazy server connections, cached tool metadata, idle timeouts
- Direct-tool promotion via `directTools`
- MCP sampling / elicitation support, gated by the host agent's capabilities
- Backward-compatible `mcpAdapter` default export — Pi users do not need to change anything
- `piMcpAdapter` alias and re-exports of `PiAdapter`, `adaptPiContext`, `DEFAULT_AGENT_RESOLVER`, `createPiResolver`, `resolveAgentGlobalConfigPath`, `AgentPathResolver`, `AgentId`

## How It Works

- One `mcp` tool in context (~200 tokens) instead of hundreds
- Servers are lazy by default — they connect on first tool call, not at startup
- Tool metadata is cached to disk so search/list/describe work without live connections
- Idle servers disconnect after 10 minutes (configurable), reconnect automatically on next use
- npx-based servers resolve to direct binary paths, skipping the ~143 MB npm parent process
- MCP server validates arguments, not the adapter
- Keep-alive servers get health checks and auto-reconnect
- Specific tools can be promoted from the proxy to first-class host-agent tools via `directTools` config, so the LLM sees them directly instead of having to search

## Limitations

- Cross-session server sharing not yet implemented (each agent session runs its own server processes)
- Compact MCP result rendering summarizes text, but inline images are still controlled by the host agent's image display settings and may render below the compact text summary
- MCP sampling support is text-only; context inclusion, tools, stop sequences, audio, and image content are rejected with explicit errors
